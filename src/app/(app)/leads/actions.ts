"use server"

import { revalidatePath } from "next/cache"

import type { ActionResult } from "@/lib/actions/crud"
import { authorize } from "@/lib/auth"

const PIPELINE_FOR_SEGMENT: Record<string, string> = {
  ai_tooling: "AI Tooling Clients",
  enterprise_crm: "Enterprise CRM",
  saas: "SaaS Customers",
}

/** Turns a lead into a CRM company plus a deal in the first stage of the matching pipeline. */
export async function convertLead(leadId: string): Promise<ActionResult<{ dealId: string | null }>> {
  const auth = await authorize("leads.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  if (!auth.can("crm.edit"))
    return { ok: false, error: "Converting a lead creates CRM records, which your role can't do." }
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single()
  if (!lead) return { ok: false, error: "Lead not found" }
  if (lead.company_id) return { ok: false, error: "Already converted" }

  const notes = [
    lead.summary,
    lead.pain_signals.length ? `Pain signals:\n- ${lead.pain_signals.join("\n- ")}` : null,
    lead.suggested_offer ? `Suggested offer: ${lead.suggested_offer}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      name: lead.company_name,
      website: lead.website,
      industry: lead.industry,
      location: lead.location,
      segment: lead.segment,
      notes,
    })
    .select("id")
    .single()
  if (error) return { ok: false, error: error.message }

  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, name, pipeline_stages(id, position)")
    .order("position")
  const pipeline = pipelines?.find((p) => p.name === PIPELINE_FOR_SEGMENT[lead.segment ?? ""]) ?? pipelines?.[0]
  const firstStage = pipeline?.pipeline_stages.sort((a, b) => a.position - b.position)[0]

  let dealId: string | null = null
  if (pipeline && firstStage) {
    const { data: deal } = await supabase
      .from("deals")
      .insert({
        pipeline_id: pipeline.id,
        stage_id: firstStage.id,
        title: lead.company_name,
        company_id: company.id,
        notes: lead.suggested_offer,
      })
      .select("id")
      .single()
    dealId = deal?.id ?? null
  }

  await supabase.from("leads").update({ status: "converted", company_id: company.id }).eq("id", leadId)
  revalidatePath("/leads")
  revalidatePath("/crm", "layout")
  return { ok: true, data: { dealId } }
}

export async function setLeadStatus(leadId: string, status: "new" | "qualified" | "discarded"): Promise<ActionResult> {
  const auth = await authorize("leads.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { error } = await supabase.from("leads").update({ status }).eq("id", leadId)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/leads")
  return { ok: true }
}
