import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { requirePermission } from "@/lib/auth"

import { DealView } from "./deal-view"

export const metadata: Metadata = { title: "Deal" }

export default async function DealPage({ params }: PageProps<"/crm/deals/[id]">) {
  const { id } = await params
  const { supabase } = await requirePermission("crm.view")
  const { data: deal } = await supabase
    .from("deals")
    .select("*, company:companies(*), contact:contacts(*), owner:profiles(full_name)")
    .eq("id", id)
    .single()
  if (!deal) notFound()

  const [{ data: pipeline }, { data: activities }, { data: companies }, { data: contacts }] = await Promise.all([
    supabase.from("pipelines").select("*, pipeline_stages(*)").eq("id", deal.pipeline_id).single(),
    supabase
      .from("activities")
      .select("*, author:profiles(full_name)")
      .eq("deal_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("contacts").select("id, full_name").order("full_name"),
  ])
  if (!pipeline) notFound()

  const { pipeline_stages, ...rest } = pipeline
  return (
    <DealView
      deal={deal}
      pipeline={{ ...rest, stages: [...pipeline_stages].sort((a, b) => a.position - b.position) }}
      activities={activities ?? []}
      companies={companies ?? []}
      contacts={contacts ?? []}
    />
  )
}
