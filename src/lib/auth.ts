import "server-only"

import { redirect } from "next/navigation"
import { cache } from "react"

import type { ActionResult } from "@/lib/actions/crud"
import { describePermission, type Permission } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"

export const getMember = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return { supabase, profile: null, permissions: new Set<Permission>() }

  const [{ data: profile }, { data: granted }] = await Promise.all([
    supabase.from("profiles").select("*, role_info:roles(name)").eq("id", userId).single(),
    supabase.rpc("my_permissions"),
  ])
  return { supabase, profile, permissions: new Set((granted ?? []) as Permission[]) }
})

/** Any signed-in account that isn't disabled. Redirects otherwise. */
export async function requireMember() {
  const { supabase, profile, permissions } = await getMember()
  if (!profile) redirect("/login")
  if (profile.role === "disabled") redirect("/disabled")
  const can = (permission: Permission) => permissions.has(permission)
  return { supabase, profile, permissions, can }
}

/** For pages: redirects to the no-access screen when the permission is missing. */
export async function requirePermission(permission: Permission) {
  const member = await requireMember()
  if (!member.can(permission)) redirect(`/no-access?need=${permission}`)
  return member
}

type Member = Awaited<ReturnType<typeof requireMember>>

/** For server actions: returns an error result instead of throwing or redirecting. */
export async function authorize(
  permission: Permission
): Promise<({ ok: true } & Member) | Extract<ActionResult, { ok: false }>> {
  const member = await requireMember()
  if (!member.can(permission)) {
    return { ok: false, error: `Your role doesn't allow you to ${describePermission(permission)}.` }
  }
  return { ok: true, ...member }
}
