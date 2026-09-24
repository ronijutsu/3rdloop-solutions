"use server"

import { revalidatePath } from "next/cache"

import type { ActionResult } from "@/lib/actions/crud"
import { authorize } from "@/lib/auth"
import { crawlerConfigured } from "@/lib/crawl4ai"
import { storeSourceScreenshot } from "@/lib/problem-evidence"

export async function captureProblemSource(problemId: string): Promise<ActionResult> {
  const auth = await authorize("problems.edit")
  if (!auth.ok) return auth
  if (!crawlerConfigured()) return { ok: false, error: "Start crawl4ai (pnpm crawler) to capture screenshots." }

  const { data: problem } = await auth.supabase.from("problems").select("id, source_url").eq("id", problemId).single()
  if (!problem?.source_url) return { ok: false, error: "Add a source link to this problem first." }

  const stored = await storeSourceScreenshot(auth.supabase, problem)
  if (!stored) {
    return {
      ok: false,
      error: "That site blocks automated previews (bot check or login wall). The link and quote are still saved.",
    }
  }
  revalidatePath("/problems")
  return { ok: true }
}
