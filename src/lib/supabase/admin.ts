import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"

/**
 * Service-role client for account administration (creating users, resetting
 * passwords). Bypasses RLS: only call it after an explicit permission check.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set, so accounts can't be managed from the app.")
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function adminConfigured() {
  return Boolean(process.env.SUPABASE_SECRET_KEY)
}
