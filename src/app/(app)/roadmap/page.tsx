import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth"

import { RoadmapView } from "./roadmap-view"

export const metadata: Metadata = { title: "Business Roadmap" }

export default async function RoadmapPage() {
  const { supabase } = await requirePermission("planning.view")
  const [{ data: items }, { data: ideas }] = await Promise.all([
    supabase.from("roadmap_items").select("*, idea:ideas(id, title)").order("start_date", { nullsFirst: false }),
    supabase.from("ideas").select("id, title").order("title"),
  ])

  return (
    <>
      <PageHeader
        title="Business Roadmap"
        description="What the company is doing across product, sales, marketing, operations, and finance — by quarter."
      />
      <RoadmapView items={items ?? []} ideas={ideas ?? []} />
    </>
  )
}
