import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth"

import { PipelineBoard } from "./pipeline-board"

export const metadata: Metadata = { title: "CRM Pipelines" }

export default async function CrmPage({ searchParams }: PageProps<"/crm">) {
  const { supabase } = await requirePermission("crm.view")
  const { pipeline: requested } = await searchParams

  const { data: pipelines } = await supabase.from("pipelines").select("*, pipeline_stages(*)").order("position")
  const current = pipelines?.find((p) => p.id === requested) ?? pipelines?.[0]

  const [{ data: deals }, { data: companies }, { data: contacts }] = await Promise.all([
    current
      ? supabase
          .from("deals")
          .select("*, company:companies(id, name), contact:contacts(id, full_name), owner:profiles(full_name)")
          .eq("pipeline_id", current.id)
          .order("position")
          .order("created_at")
      : Promise.resolve({ data: [] }),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("contacts").select("id, full_name").order("full_name"),
  ])

  return (
    <>
      <PageHeader
        title="CRM Pipelines"
        description="Track deals for AI tooling clients, enterprise CRM work, and SaaS customers. Drag cards between stages."
      />
      <PipelineBoard
        pipelines={(pipelines ?? []).map(({ pipeline_stages, ...p }) => ({
          ...p,
          stages: [...pipeline_stages].sort((a, b) => a.position - b.position),
        }))}
        currentId={current?.id ?? null}
        deals={deals ?? []}
        companies={companies ?? []}
        contacts={contacts ?? []}
      />
    </>
  )
}
