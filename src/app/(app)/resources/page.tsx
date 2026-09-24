import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth"

import { ResourceLibrary } from "./resource-library"

export const metadata: Metadata = { title: "Resources Library" }

export default async function ResourcesPage() {
  const { supabase } = await requirePermission("resources.view")
  const { data: resources } = await supabase
    .from("resources")
    .select("*, author:profiles(full_name)")
    .order("created_at", { ascending: false })

  return (
    <>
      <PageHeader
        title="Resources Library"
        description="Playbooks, tools, articles, courses, and legal or finance references the team keeps coming back to."
      />
      <ResourceLibrary resources={resources ?? []} />
    </>
  )
}
