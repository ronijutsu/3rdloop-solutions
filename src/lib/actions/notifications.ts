"use server"

import type { ActionResult } from "@/lib/actions/crud"
import { requireMember } from "@/lib/auth"

/** Marks notifications as read for the signed-in person. */
export async function markNotificationsRead(keys: string[]): Promise<ActionResult> {
  const { supabase, profile } = await requireMember()
  const unique = [...new Set(keys)].filter((k) => k.length < 300).slice(0, 200)
  if (!unique.length) return { ok: true }
  const { error } = await supabase.from("notification_reads").upsert(
    unique.map((key) => ({ profile_id: profile.id, key })),
    { ignoreDuplicates: true }
  )
  return error ? { ok: false, error: error.message } : { ok: true }
}
