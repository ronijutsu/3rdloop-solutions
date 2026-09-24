"use server"

import type { JSONContent } from "@tiptap/react"
import { revalidatePath } from "next/cache"

import type { ActionResult } from "@/lib/actions/crud"
import { authorize } from "@/lib/auth"
import type { Database } from "@/lib/supabase/database.types"

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"]
type Json = Database["public"]["Tables"]["tasks"]["Row"]["body"]

/** Fields the task page and board may change directly. Lifecycle columns are set by triggers. */
const TASK_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "kind",
  "story_points",
  "teams",
  "start_date",
  "due_date",
  "frequency",
  "reporting_period",
  "progress",
  "sprint_id",
] as const satisfies readonly (keyof TaskUpdate)[]

async function edit() {
  return authorize("planning.edit")
}

type Client = Extract<Awaited<ReturnType<typeof edit>>, { ok: true }>["supabase"]

async function projectOf(supabase: Client, taskId: string) {
  const { data } = await supabase.from("tasks").select("project_id").eq("id", taskId).single()
  return data?.project_id ?? null
}

function refresh(projectId: string | null) {
  if (projectId) revalidatePath(`/projects/${projectId}`, "layout")
  revalidatePath("/projects")
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/** Projects offered by the top bar's quick "New task" dialog. */
export async function quickTaskProjects(): Promise<ActionResult<{ id: string; name: string; key: string }[]>> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { data, error } = await auth.supabase
    .from("projects")
    .select("id, name, key")
    .neq("status", "done")
    .order("updated_at", { ascending: false })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

/** Creates a task, or a sub-task when `parentId` is given (it joins the parent's project and sprint). */
export async function createTask(input: {
  projectId: string
  title: string
  sprintId?: string | null
  status?: string
  kind?: string
  parentId?: string
}): Promise<ActionResult<{ id: string }>> {
  const auth = await edit()
  if (!auth.ok) return auth
  const title = input.title.trim()
  if (!title) return { ok: false, error: "Give the task a title" }
  if (input.parentId) {
    const { data, error } = await auth.supabase
      .from("tasks")
      .insert({ project_id: input.projectId, parent_id: input.parentId, title, kind: input.kind ?? "task" })
      .select("id")
      .single()
    if (error) return { ok: false, error: error.message }
    refresh(input.projectId)
    return { ok: true, data: { id: data.id } }
  }
  const { data, error } = await auth.supabase
    .from("tasks")
    .insert({
      project_id: input.projectId,
      title,
      sprint_id: input.sprintId ?? null,
      status: input.status ?? "todo",
      kind: input.kind ?? "task",
    })
    .select("id")
    .single()
  if (error) return { ok: false, error: error.message }
  refresh(input.projectId)
  return { ok: true, data: { id: data.id } }
}

export async function updateTask(taskId: string, patch: Partial<Record<(typeof TASK_FIELDS)[number], unknown>>) {
  const auth = await edit()
  if (!auth.ok) return auth
  const values: Record<string, unknown> = {}
  for (const key of TASK_FIELDS) {
    if (!(key in patch)) continue
    const v = patch[key]
    values[key] = v === "" ? null : v
  }
  if ("title" in values && !String(values.title ?? "").trim()) return { ok: false, error: "Title can't be empty" }
  const { data, error } = await auth.supabase
    .from("tasks")
    .update(values as TaskUpdate)
    .eq("id", taskId)
    .select("project_id")
    .single()
  if (error) return { ok: false, error: error.message }
  refresh(data.project_id)
  return { ok: true }
}

/** Body autosave: no revalidation, so typing never re-renders the page. */
export async function saveTaskBody(taskId: string, body: JSONContent): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { error } = await auth.supabase
    .from("tasks")
    .update({ body: body as Json })
    .eq("id", taskId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function setTaskAssignees(taskId: string, profileIds: string[]): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { supabase } = auth
  const { data: current, error: readError } = await supabase
    .from("task_assignees")
    .select("profile_id")
    .eq("task_id", taskId)
  if (readError) return { ok: false, error: readError.message }
  const have = new Set(current.map((a) => a.profile_id))
  const want = new Set(profileIds)
  const add = [...want].filter((id) => !have.has(id))
  const remove = [...have].filter((id) => !want.has(id))
  if (add.length) {
    const { error } = await supabase
      .from("task_assignees")
      .insert(add.map((profile_id) => ({ task_id: taskId, profile_id })))
    if (error) return { ok: false, error: error.message }
  }
  if (remove.length) {
    const { error } = await supabase.from("task_assignees").delete().eq("task_id", taskId).in("profile_id", remove)
    if (error) return { ok: false, error: error.message }
  }
  refresh(await projectOf(auth.supabase, taskId))
  return { ok: true }
}

export async function archiveTask(taskId: string, archived: boolean): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { data, error } = await auth.supabase
    .from("tasks")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", taskId)
    .select("project_id")
    .single()
  if (error) return { ok: false, error: error.message }
  refresh(data.project_id)
  return { ok: true }
}

/** Permanently deletes the task, its history, and its attachment files. */
export async function deleteTask(taskId: string): Promise<ActionResult<{ projectId: string }>> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { supabase } = auth
  const { data: files } = await supabase.from("task_attachments").select("storage_path").eq("task_id", taskId)
  const projectId = await projectOf(auth.supabase, taskId)
  const { error } = await supabase.from("tasks").delete().eq("id", taskId)
  if (error) return { ok: false, error: error.message }
  if (files?.length) await supabase.storage.from("project-files").remove(files.map((f) => f.storage_path))
  refresh(projectId)
  return { ok: true, data: { projectId: projectId ?? "" } }
}

// ---------------------------------------------------------------------------
// Notes and attachments
// ---------------------------------------------------------------------------

export async function postNote(taskId: string, body: JSONContent, html: string): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const text = html.replace(/<[^>]+>/g, "").trim()
  if (!text) return { ok: false, error: "Write something first" }
  const { error } = await auth.supabase
    .from("task_notes")
    .insert({ task_id: taskId, author_id: auth.profile.id, body: body as Json, body_html: html })
  if (error) return { ok: false, error: error.message }
  refresh(await projectOf(auth.supabase, taskId))
  return { ok: true }
}

export async function deleteNote(id: string): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { data, error } = await auth.supabase.from("task_notes").delete().eq("id", id).select("task_id").maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: "You can only delete your own notes" }
  refresh(await projectOf(auth.supabase, data.task_id))
  return { ok: true }
}

/** Records a file the browser already uploaded to project-files/{project}/{task}/…; removes it again on failure. */
export async function recordAttachment(
  taskId: string,
  file: { name: string; path: string; mime: string | null; size: number }
): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const projectId = await projectOf(auth.supabase, taskId)
  if (!projectId || !file.path.startsWith(`${projectId}/${taskId}/`)) {
    await auth.supabase.storage.from("project-files").remove([file.path])
    return { ok: false, error: "Attachment path doesn't belong to this task" }
  }
  const { error } = await auth.supabase.from("task_attachments").insert({
    task_id: taskId,
    name: file.name,
    storage_path: file.path,
    mime_type: file.mime,
    size_bytes: file.size,
  })
  if (error) {
    await auth.supabase.storage.from("project-files").remove([file.path])
    return { ok: false, error: error.message }
  }
  refresh(projectId)
  return { ok: true }
}

export async function deleteAttachment(id: string): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { data, error } = await auth.supabase
    .from("task_attachments")
    .delete()
    .eq("id", id)
    .select("task_id, storage_path")
    .single()
  if (error) return { ok: false, error: error.message }
  await auth.supabase.storage.from("project-files").remove([data.storage_path])
  refresh(await projectOf(auth.supabase, data.task_id))
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Sprints
// ---------------------------------------------------------------------------

export async function saveSprint(
  projectId: string,
  id: string | null,
  values: { name: string; goal: string; start_date: string; end_date: string }
): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const name = values.name.trim()
  if (!name) return { ok: false, error: "Name the sprint" }
  const row = {
    name,
    goal: values.goal.trim() || null,
    start_date: values.start_date || null,
    end_date: values.end_date || null,
  }
  const { error } = id
    ? await auth.supabase.from("sprints").update(row).eq("id", id)
    : await auth.supabase.from("sprints").insert({ ...row, project_id: projectId })
  if (error) return { ok: false, error: error.message }
  refresh(projectId)
  return { ok: true }
}

export async function deleteSprint(projectId: string, id: string): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  // Its tasks fall back to the backlog (sprint_id on delete set null).
  const { error } = await auth.supabase.from("sprints").delete().eq("id", id).eq("status", "planned")
  if (error) return { ok: false, error: error.message }
  refresh(projectId)
  return { ok: true }
}

export async function startSprint(projectId: string, id: string): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { error } = await auth.supabase.rpc("start_sprint", { p_sprint: id })
  if (error) return { ok: false, error: error.message }
  refresh(projectId)
  return { ok: true }
}

export async function completeSprint(projectId: string, id: string, moveTo: string | null): Promise<ActionResult> {
  const auth = await edit()
  if (!auth.ok) return auth
  const { error } = await auth.supabase.rpc("complete_sprint", { p_sprint: id, p_move_to: moveTo ?? undefined })
  if (error) return { ok: false, error: error.message }
  refresh(projectId)
  return { ok: true }
}
