import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { captureScreenshot } from "@/lib/crawl4ai"
import type { Database } from "@/lib/supabase/database.types"

/**
 * Screenshots a problem's source page into the private "evidence" bucket.
 * Returns false when the source can't be shown (bot checks, login walls, errors),
 * in which case the link and verbatim quote remain the evidence.
 */
export async function storeSourceScreenshot(
  supabase: SupabaseClient<Database>,
  problem: { id: string; source_url: string | null }
): Promise<boolean> {
  if (!problem.source_url) return false
  const capture = await captureScreenshot(problem.source_url)
  if (!capture) return false

  const path = `problems/${problem.id}.png`
  const { error } = await supabase.storage
    .from("evidence")
    .upload(path, capture.png, { contentType: "image/png", upsert: true })
  if (error) return false

  await supabase
    .from("problems")
    .update({
      screenshot_path: path,
      screenshot_taken_at: new Date().toISOString(),
      ...(capture.title ? { source_title: capture.title } : {}),
    })
    .eq("id", problem.id)
  return true
}
