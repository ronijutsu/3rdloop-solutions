import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { aiConfigured, configuredModels } from "@/lib/ai/client"
import { requireMember } from "@/lib/auth"
import { jevConfigured } from "@/lib/ai/jev"
import { crawlerConfigured } from "@/lib/crawl4ai"
import { adminConfigured } from "@/lib/supabase/admin"

import { SettingsView } from "./settings-view"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const { supabase, profile, can } = await requireMember()
  const [{ data: members }, { data: roles }, { data: permissions }, { data: grants }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("roles").select("*").order("position").order("name"),
    supabase.from("permissions").select("*").order("position"),
    supabase.from("role_permissions").select("*"),
  ])

  return (
    <>
      <PageHeader title="Settings" description="Your profile, the team, roles and permissions, and integrations." />
      <SettingsView
        me={profile}
        members={members ?? []}
        roles={roles ?? []}
        permissions={permissions ?? []}
        grants={grants ?? []}
        canManageTeam={can("team.manage")}
        canManageRoles={can("roles.manage")}
        integrations={{
          ai: aiConfigured(),
          models: configuredModels(),
          crawler: crawlerConfigured(),
          jev: jevConfigured(),
          admin: adminConfigured(),
        }}
      />
    </>
  )
}
