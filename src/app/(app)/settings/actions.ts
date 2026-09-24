"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"

import type { ActionResult } from "@/lib/actions/crud"
import { authorize, requireMember } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"

const password = z.string().min(8, "Password must be at least 8 characters")

async function roleExists(supabase: Awaited<ReturnType<typeof requireMember>>["supabase"], role: string) {
  const { data } = await supabase.from("roles").select("key").eq("key", role).maybeSingle()
  return Boolean(data)
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export async function createMember(input: {
  email: string
  full_name: string
  password: string
  role: string
}): Promise<ActionResult> {
  const auth = await authorize("team.manage")
  if (!auth.ok) return auth

  const parsed = z
    .object({
      email: z.email("Enter a valid email"),
      full_name: z.string().trim().min(1, "Enter a name"),
      password,
      role: z.string(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  if (!(await roleExists(auth.supabase, parsed.data.role))) return { ok: false, error: "Unknown role" }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.full_name },
      app_metadata: { role: parsed.data.role },
    })
    if (error) return { ok: false, error: error.message }
    // The profile is created by a trigger (as disabled) before app_metadata is written; assign the role now.
    const { error: roleError } = await admin.from("profiles").update({ role: parsed.data.role }).eq("id", data.user.id)
    if (roleError) return { ok: false, error: roleError.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't create the account" }
  }
  revalidatePath("/settings")
  return { ok: true }
}

export async function setMemberRole(memberId: string, role: string): Promise<ActionResult> {
  const auth = await authorize("team.manage")
  if (!auth.ok) return auth
  if (memberId === auth.profile.id) return { ok: false, error: "You can't change your own role." }
  if (!(await roleExists(auth.supabase, role))) return { ok: false, error: "Unknown role" }

  // The database also refuses to demote the last admin.
  const { error } = await auth.supabase.from("profiles").update({ role }).eq("id", memberId)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/settings")
  return { ok: true }
}

export async function resetMemberPassword(memberId: string, newPassword: string): Promise<ActionResult> {
  const auth = await authorize("team.manage")
  if (!auth.ok) return auth
  const parsed = password.safeParse(newPassword)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    const { error } = await createAdminClient().auth.admin.updateUserById(memberId, { password: parsed.data })
    if (error) return { ok: false, error: error.message }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't reset the password" }
  }
  return { ok: true }
}

export async function updateMyName(fullName: string): Promise<ActionResult> {
  const { supabase, profile } = await requireMember()
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName.trim() || null })
    .eq("id", profile.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/", "layout")
  return { ok: true }
}

/** Lets anyone change their own password after confirming the current one. */
export async function changeMyPassword(current: string, next: string): Promise<ActionResult> {
  const { supabase, profile } = await requireMember()
  const parsed = password.safeParse(next)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  if (current === next) return { ok: false, error: "Choose a password different from the current one" }

  // Check the current password with a throwaway client so the signed-in session isn't touched.
  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
  const { error: signInError } = await verifier.auth.signInWithPassword({ email: profile.email, password: current })
  if (signInError) return { ok: false, error: "Your current password is incorrect" }
  await verifier.auth.signOut()

  const { error } = await supabase.auth.updateUser({ password: parsed.data })
  return error ? { ok: false, error: error.message } : { ok: true }
}

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------

export async function createRole(name: string, description: string): Promise<ActionResult> {
  const auth = await authorize("roles.manage")
  if (!auth.ok) return auth
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30)
  if (!/^[a-z][a-z0-9_]{1,30}$/.test(key)) return { ok: false, error: "Use a name that starts with a letter" }

  const { error } = await auth.supabase
    .from("roles")
    .insert({ key, name: name.trim(), description: description.trim() || null, position: 50 })
  if (error)
    return { ok: false, error: error.code === "23505" ? "A role with that name already exists" : error.message }
  revalidatePath("/settings")
  return { ok: true }
}

export async function deleteRole(key: string): Promise<ActionResult> {
  const auth = await authorize("roles.manage")
  if (!auth.ok) return auth
  const { error } = await auth.supabase.from("roles").delete().eq("key", key)
  if (error) {
    return {
      ok: false,
      error: error.code === "23503" ? "Move everyone off this role before deleting it" : error.message,
    }
  }
  revalidatePath("/settings")
  return { ok: true }
}

export async function setRolePermission(role: string, permission: string, granted: boolean): Promise<ActionResult> {
  const auth = await authorize("roles.manage")
  if (!auth.ok) return auth
  const { error } = granted
    ? await auth.supabase.from("role_permissions").upsert({ role, permission })
    : await auth.supabase.from("role_permissions").delete().eq("role", role).eq("permission", permission)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/", "layout")
  return { ok: true }
}
