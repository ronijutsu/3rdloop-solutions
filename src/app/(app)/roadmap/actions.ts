"use server"

import type { JSONContent } from "@tiptap/react"
import { revalidatePath } from "next/cache"

import type { ActionResult } from "@/lib/actions/crud"
import { authorize } from "@/lib/auth"
import type { Database } from "@/lib/supabase/database.types"

type Tables = Database["public"]["Tables"]
type Json = Tables["roadmap_items"]["Row"]["body"]
export type LinkKind = Tables["roadmap_links"]["Row"]["kind"]

const ITEM_FIELDS = [
  "title",
  "description",
  "lane",
  "status",
  "start_date",
  "end_date",
  "idea_id",
  "owner_id",
] as const satisfies readonly (keyof Tables["roadmap_items"]["Update"])[]

const edit = () => authorize("planning.edit")

function refresh(itemId: string) {
  revalidatePath(`/roadmap/${itemId}`)
  revalidatePath("/roadmap")
}

export async function updateRoadmapItem(
  id: string,
  patch: Partial<Record<(typeof ITEM_FIELDS)[number], string | null>>
): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const values: Record<string, string | null> = {}
  for (const key of ITEM_FIELDS) if (key in patch) values[key] = patch[key] || null
  if ("title" in values && !values.title?.trim()) return { ok: false, error: "Title can't be empty" }
  const { error } = await auth.supabase
    .from("roadmap_items")
    .update(values as Tables["roadmap_items"]["Update"])
    .eq("id", id)
  if (error) return { ok: false, error: error.message }
  refresh(id)
  return { ok: true }
}

/** Body autosave: no revalidation so typing never re-renders the page. */
export async function saveRoadmapBody(id: string, body: JSONContent): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { error } = await auth.supabase
    .from("roadmap_items")
    .update({ body: body as Json })
    .eq("id", id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function deleteRoadmapItem(id: string): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { data: files } = await auth.supabase.from("roadmap_attachments").select("storage_path").eq("item_id", id)
  const { error } = await auth.supabase.from("roadmap_items").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  if (files?.length) await auth.supabase.storage.from("project-files").remove(files.map((f) => f.storage_path))
  revalidatePath("/roadmap")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export async function addMilestone(itemId: string, title: string, dueDate: string): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  if (!title.trim()) return { ok: false, error: "Name the milestone" }
  const { count } = await auth.supabase
    .from("roadmap_milestones")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId)
  const { error } = await auth.supabase
    .from("roadmap_milestones")
    .insert({ item_id: itemId, title: title.trim(), due_date: dueDate || null, position: count ?? 0 })
  if (error) return { ok: false, error: error.message }
  refresh(itemId)
  return { ok: true }
}

export async function updateMilestone(id: string, patch: { done?: boolean }): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { data, error } = await auth.supabase
    .from("roadmap_milestones")
    .update(patch)
    .eq("id", id)
    .select("item_id")
    .single()
  if (error) return { ok: false, error: error.message }
  refresh(data.item_id)
  return { ok: true }
}

export async function deleteMilestone(id: string): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { data, error } = await auth.supabase
    .from("roadmap_milestones")
    .delete()
    .eq("id", id)
    .select("item_id")
    .single()
  if (error) return { ok: false, error: error.message }
  refresh(data.item_id)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export async function addLink(
  itemId: string,
  link: { kind: LinkKind; targetId?: string; url?: string; label: string; note?: string }
): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const isUrl = link.kind === "url"
  const url = link.url?.trim()
  if (isUrl && !/^https?:\/\//i.test(url ?? "")) return { ok: false, error: "Enter a full link starting with https://" }
  if (!isUrl && !link.targetId) return { ok: false, error: "Pick something to link" }
  const label = link.label.trim() || url || "Link"
  const { error } = await auth.supabase.from("roadmap_links").insert({
    item_id: itemId,
    kind: link.kind,
    target_id: isUrl ? null : link.targetId,
    url: isUrl ? url : null,
    label,
    note: link.note?.trim() || null,
  })
  if (error) {
    return { ok: false, error: error.code === "23505" ? "That's already linked" : error.message }
  }
  refresh(itemId)
  return { ok: true }
}

export async function deleteLink(id: string): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { data, error } = await auth.supabase.from("roadmap_links").delete().eq("id", id).select("item_id").single()
  if (error) return { ok: false, error: error.message }
  refresh(data.item_id)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Attachments and updates
// ---------------------------------------------------------------------------

/** Records a file the browser already uploaded to project-files/roadmap/{item}/…; removes it again on failure. */
export async function recordRoadmapAttachment(
  itemId: string,
  file: { name: string; path: string; mime: string | null; size: number }
): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  if (!file.path.startsWith(`roadmap/${itemId}/`)) {
    await auth.supabase.storage.from("project-files").remove([file.path])
    return { ok: false, error: "Attachment path doesn't belong to this item" }
  }
  const { error } = await auth.supabase.from("roadmap_attachments").insert({
    item_id: itemId,
    name: file.name,
    storage_path: file.path,
    mime_type: file.mime,
    size_bytes: file.size,
  })
  if (error) {
    await auth.supabase.storage.from("project-files").remove([file.path])
    return { ok: false, error: error.message }
  }
  refresh(itemId)
  return { ok: true }
}

export async function deleteRoadmapAttachment(id: string): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { data, error } = await auth.supabase
    .from("roadmap_attachments")
    .delete()
    .eq("id", id)
    .select("item_id, storage_path")
    .single()
  if (error) return { ok: false, error: error.message }
  await auth.supabase.storage.from("project-files").remove([data.storage_path])
  refresh(data.item_id)
  return { ok: true }
}

export async function postRoadmapUpdate(itemId: string, body: JSONContent, html: string): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  if (!html.replace(/<[^>]+>/g, "").trim()) return { ok: false, error: "Write something first" }
  const { error } = await auth.supabase
    .from("roadmap_updates")
    .insert({ item_id: itemId, author_id: auth.profile.id, body: body as Json, body_html: html })
  if (error) return { ok: false, error: error.message }
  refresh(itemId)
  return { ok: true }
}

export async function deleteRoadmapUpdate(id: string): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { data, error } = await auth.supabase
    .from("roadmap_updates")
    .delete()
    .eq("id", id)
    .select("item_id")
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: "You can only delete your own updates" }
  refresh(data.item_id)
  return { ok: true }
}
