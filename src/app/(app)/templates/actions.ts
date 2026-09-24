"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { ActionResult } from "@/lib/actions/crud"
import { authorize, requirePermission } from "@/lib/auth"

export async function createTemplate() {
  const { supabase } = await requirePermission("templates.edit")
  const { data, error } = await supabase
    .from("document_templates")
    .insert({ name: "Untitled template", category: "other" })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  redirect(`/templates/${data.id}`)
}

export async function saveTemplate(
  id: string,
  values: { name?: string; category?: string; description?: string | null; body_html?: string }
): Promise<ActionResult> {
  const auth = await authorize("templates.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { error } = await supabase.from("document_templates").update(values).eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/templates")
  return { ok: true }
}

export async function deleteTemplate(id: string) {
  const { supabase } = await requirePermission("templates.edit")
  await supabase.from("document_templates").delete().eq("id", id)
  revalidatePath("/templates")
  redirect("/templates")
}
