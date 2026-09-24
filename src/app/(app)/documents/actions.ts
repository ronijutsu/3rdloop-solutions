"use server"

import type { Json } from "@/lib/supabase/database.types"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { ActionResult } from "@/lib/actions/crud"
import { authorize, requirePermission } from "@/lib/auth"

export async function createDocument(templateId: string | null, ideaId: string | null) {
  const { supabase, profile } = await requirePermission("documents.edit")

  let title = "Untitled"
  let content: Json = { type: "doc", content: [] }
  let category: string | null = null
  if (templateId) {
    const { data: template } = await supabase.from("document_templates").select("*").eq("id", templateId).single()
    if (template) {
      title = template.name
      category = template.category
      // Templates are stored as HTML; the editor converts this to Tiptap JSON on first save.
      content = { html: template.body_html }
    }
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({ title, content, category, template_id: templateId, idea_id: ideaId, updated_by: profile.id })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  revalidatePath("/documents")
  redirect(`/documents/${data.id}`)
}

export async function saveDocument(
  id: string,
  values: { title?: string; content?: Json; category?: string | null; idea_id?: string | null }
): Promise<ActionResult> {
  const auth = await authorize("documents.edit")
  if (!auth.ok) return auth
  const { supabase, profile } = auth
  const { error } = await supabase
    .from("documents")
    .update({ ...values, updated_by: profile.id })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/documents")
  return { ok: true }
}

export async function deleteDocument(id: string) {
  const { supabase } = await requirePermission("documents.edit")
  await supabase.from("documents").delete().eq("id", id)
  revalidatePath("/documents")
  redirect("/documents")
}

export async function saveAsTemplate(id: string, html: string): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("templates.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { data: doc } = await supabase.from("documents").select("title, category").eq("id", id).single()
  if (!doc) return { ok: false, error: "Document not found" }
  const { data, error } = await supabase
    .from("document_templates")
    .insert({ name: doc.title, category: doc.category ?? "other", body_html: html })
    .select("id")
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath("/templates")
  return { ok: true, data }
}
