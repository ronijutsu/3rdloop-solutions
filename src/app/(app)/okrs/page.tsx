import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth"

import { OkrBoard } from "./okr-board"

export const metadata: Metadata = { title: "Goals & OKRs" }

export default async function OkrsPage() {
  const { supabase } = await requirePermission("planning.view")
  const [{ data: objectives }, { data: founders }] = await Promise.all([
    supabase
      .from("objectives")
      .select("*, owner:profiles(full_name), key_results(*)")
      .order("period", { ascending: false })
      .order("created_at"),
    supabase.from("profiles").select("id, full_name, email").in("role", ["founder", "admin"]),
  ])

  return (
    <>
      <PageHeader
        title="Goals & OKRs"
        description="Objectives set direction; key results prove progress with numbers."
      />
      <OkrBoard objectives={objectives ?? []} founders={founders ?? []} />
    </>
  )
}
