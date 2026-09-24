import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth"

import { ContentPlanner } from "./content-planner"

export const metadata: Metadata = { title: "Content Planner" }

export default async function ContentPage() {
  const { supabase } = await requirePermission("content.view")
  const [{ data: items }, { data: founders }] = await Promise.all([
    supabase.from("content_items").select("*, owner:profiles(full_name)").order("publish_date", { nullsFirst: false }),
    supabase.from("profiles").select("id, full_name, email").in("role", ["founder", "admin"]),
  ])

  return (
    <>
      <PageHeader
        title="Content Planner"
        description="Plan posts, newsletters, and videos that build trust with the people you sell to."
      />
      <ContentPlanner items={items ?? []} founders={founders ?? []} />
    </>
  )
}
