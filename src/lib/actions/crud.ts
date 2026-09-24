"use server"

import { revalidatePath } from "next/cache"

import type { SupabaseClient } from "@supabase/supabase-js"

import { authorize } from "@/lib/auth"
import { TABLE_EDIT_PERMISSION } from "@/lib/permissions"
import type { Database } from "@/lib/supabase/database.types"

type Table = keyof Database["public"]["Tables"]

// Tables the generic editor is allowed to write. Everything else goes through
// purpose-built actions (voting, idea stages, profiles).
const EDITABLE = new Set<Table>([
  "companies",
  "contacts",
  "deals",
  "activities",
  "leads",
  "problems",
  "surveys",
  "survey_questions",
  "roadmap_items",
  "objectives",
  "key_results",
  "projects",
  "tasks",
  "network_contacts",
  "resources",
  "transactions",
  "content_items",
  "document_templates",
  "decisions",
  "idea_questions",
  "idea_stage_reviews",
  "pipelines",
  "pipeline_stages",
  "uploads",
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untyped = (client: unknown) => client as SupabaseClient<any, "public", any>

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string }

type Values = Record<string, unknown>

function clean(values: Values) {
  const out: Values = {}
  for (const [key, value] of Object.entries(values)) {
    if (key.startsWith("$")) continue
    out[key] = value === "" ? null : value
  }
  return out
}

async function authorizeTable(table: Table) {
  const permission = TABLE_EDIT_PERMISSION[table]
  if (!EDITABLE.has(table) || !permission) {
    return { ok: false as const, error: `Table ${table} is not editable here` }
  }
  return authorize(permission)
}

export async function saveRow(
  table: Table,
  id: string | null,
  values: Values,
  revalidate: string
): Promise<ActionResult<{ id: string }>> {
  const auth = await authorizeTable(table)
  if (!auth.ok) return auth
  const { supabase } = auth
  const payload = clean(values)

  // Dynamic table name: the generated types can't narrow a union of tables, so we
  // go through an untyped handle. RLS and table constraints remain the real guard.
  const from = untyped(supabase).from(table)
  const { data, error } = id
    ? await from.update(payload).eq("id", id).select("id").single()
    : await from.insert(payload).select("id").single()
  if (error) return { ok: false, error: error.message }
  revalidatePath(revalidate, "layout")
  return { ok: true, data: data as { id: string } }
}

export async function deleteRow(table: Table, id: string, revalidate: string): Promise<ActionResult> {
  const auth = await authorizeTable(table)
  if (!auth.ok) return auth
  const { supabase } = auth
  const { error } = await untyped(supabase).from(table).delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath(revalidate, "layout")
  return { ok: true }
}
