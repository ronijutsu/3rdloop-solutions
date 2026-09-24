import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { aiConfigured } from "@/lib/ai/client"
import { requirePermission } from "@/lib/auth"
import { crawlerConfigured } from "@/lib/crawl4ai"

import { LeadFinder } from "./lead-finder"

export const metadata: Metadata = { title: "Lead Generation" }

export default async function LeadsPage() {
  const { supabase, can } = await requirePermission("leads.view")
  const [{ data: leads }, { data: searches }] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .order("fit_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("lead_searches").select("*").order("created_at", { ascending: false }).limit(8),
  ])

  return (
    <>
      <PageHeader
        title="Lead Generation"
        description="Find Philippine businesses that need AI tooling, enterprise CRM, or SaaS, crawled with crawl4ai and qualified by AI."
      />
      <LeadFinder
        leads={leads ?? []}
        searches={searches ?? []}
        ready={{ ai: aiConfigured(), crawler: crawlerConfigured() }}
        canRun={can("leads.run") && can("ai.use")}
      />
    </>
  )
}
