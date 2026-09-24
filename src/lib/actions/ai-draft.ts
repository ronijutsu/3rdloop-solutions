"use server"

import type { ActionResult } from "@/lib/actions/crud"
import { draftDocument } from "@/lib/ai/tasks"
import { authorize } from "@/lib/auth"

export async function draftWithAI(input: {
  title: string
  instructions: string
  currentHtml: string
  mode: "replace" | "append"
}): Promise<ActionResult<{ html: string }>> {
  const auth = await authorize("ai.use")
  if (!auth.ok) return auth
  if (!input.instructions.trim()) return { ok: false, error: "Tell the AI what to write" }
  try {
    const html = await draftDocument(input)
    return { ok: true, data: { html } }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Drafting failed" }
  }
}
