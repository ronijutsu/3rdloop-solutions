"use server"

import { revalidatePath } from "next/cache"

import type { ActionResult } from "@/lib/actions/crud"
import { authorize } from "@/lib/auth"

export async function moveDeal(dealId: string, stageId: string): Promise<ActionResult> {
  const auth = await authorize("crm.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { error } = await supabase.from("deals").update({ stage_id: stageId }).eq("id", dealId)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/crm", "layout")
  return { ok: true }
}

export async function createPipeline(input: {
  name: string
  description: string
  stages: { name: string; probability: number }[]
}): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("crm.edit")
  if (!auth.ok) return auth
  const { supabase } = auth

  const name = input.name.trim()
  const stages = input.stages
    .map((s) => ({ name: s.name.trim(), probability: Math.min(100, Math.max(0, Math.round(s.probability || 0))) }))
    .filter((s) => s.name)
  if (!name) return { ok: false, error: "Name the pipeline" }
  if (stages.length === 0) return { ok: false, error: "Add at least one open stage" }

  const { count } = await supabase.from("pipelines").select("id", { count: "exact", head: true })
  const { data, error } = await supabase
    .from("pipelines")
    .insert({ name, description: input.description.trim() || null, position: count ?? 0 })
    .select("id")
    .single()
  if (error) return { ok: false, error: error.message }

  // Every pipeline ends in Won and Lost so forecasts and win rates work the same everywhere.
  const rows = [
    ...stages.map((s) => ({ ...s, kind: "open" })),
    { name: "Won", probability: 100, kind: "won" },
    { name: "Lost", probability: 0, kind: "lost" },
  ].map((s, position) => ({ ...s, pipeline_id: data.id, position }))
  const { error: stageError } = await supabase.from("pipeline_stages").insert(rows)
  if (stageError) {
    await supabase.from("pipelines").delete().eq("id", data.id)
    return { ok: false, error: stageError.message }
  }
  revalidatePath("/crm")
  return { ok: true, data }
}

export async function logActivity(
  target: { deal_id?: string; company_id?: string; contact_id?: string },
  kind: "note" | "call" | "email" | "meeting" | "task",
  body: string,
  dueAt: string | null
): Promise<ActionResult> {
  const auth = await authorize("crm.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  if (!body.trim()) return { ok: false, error: "Write something first" }
  const { error } = await supabase
    .from("activities")
    .insert({ ...target, kind, body: body.trim(), due_at: dueAt ? new Date(dueAt).toISOString() : null })
  if (error) return { ok: false, error: error.message }
  revalidatePath("/crm", "layout")
  return { ok: true }
}

export async function toggleActivity(id: string, done: boolean): Promise<ActionResult> {
  const auth = await authorize("crm.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { error } = await supabase.from("activities").update({ done }).eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/crm", "layout")
  return { ok: true }
}
