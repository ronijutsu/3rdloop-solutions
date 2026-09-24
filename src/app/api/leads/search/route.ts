import { z } from "zod"

import { aiConfigured } from "@/lib/ai/client"
import { analyzeLeads, planLeadSearch } from "@/lib/ai/tasks"
import { getMember } from "@/lib/auth"
import { crawl, crawlerConfigured, searchBusinesses } from "@/lib/crawl4ai"

export const maxDuration = 300

const Body = z.object({
  query: z.string().trim().min(3),
  segment: z.enum(["ai_tooling", "enterprise_crm", "saas", "other"]),
  seedUrls: z.array(z.url()).max(25).default([]),
  limit: z.number().int().min(1).max(20).default(8),
})

export type LeadSearchEvent =
  | { type: "status"; message: string }
  | { type: "done"; searchId: string; found: number; added: number; vendors: number; outsideMarket: number }
  | { type: "error"; message: string }

export async function POST(request: Request) {
  const { supabase, profile, permissions } = await getMember()
  if (!profile || profile.role === "disabled") return new Response("Unauthorized", { status: 401 })
  if (!permissions.has("leads.run") || !permissions.has("ai.use")) {
    return Response.json({ error: "Your role doesn't allow running lead searches." }, { status: 403 })
  }

  const parsed = Body.safeParse(await request.json())
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { query, segment, seedUrls, limit } = parsed.data

  if (!aiConfigured()) return Response.json({ error: "OPENROUTER_API_KEY is not set" }, { status: 503 })
  if (!crawlerConfigured()) return Response.json({ error: "CRAWL4AI_URL is not set" }, { status: 503 })

  const { data: search, error } = await supabase
    .from("lead_searches")
    .insert({ query, segment, seed_urls: seedUrls })
    .select("id")
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: LeadSearchEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))

      try {
        let urls = seedUrls
        let customerType: string | undefined
        if (urls.length === 0) {
          send({ type: "status", message: "Planning searches for the businesses you described…" })
          const plan = await planLeadSearch(query, segment)
          customerType = plan.customer_type
          send({ type: "status", message: `Searching the web for ${plan.customer_type}…` })
          // Over-fetch: some candidates will turn out to be vendors or directories.
          urls = await searchBusinesses(plan.queries, Math.min(limit * 2, 20))
        }
        if (urls.length === 0) throw new Error("No candidate websites found. Try a broader search or add seed URLs.")

        const pages = []
        for (let i = 0; i < urls.length; i += 4) {
          const batch = urls.slice(i, i + 4)
          send({ type: "status", message: `Reading ${Math.min(i + 4, urls.length)} of ${urls.length} websites…` })
          pages.push(...(await crawl(batch).catch(() => [])))
        }
        if (pages.length === 0) throw new Error("crawl4ai couldn't read any of the candidate sites.")

        send({ type: "status", message: `Qualifying ${pages.length} businesses and filtering out vendors…` })
        const { prospects, vendors, outsideMarket } = await analyzeLeads(pages, query, segment, customerType)
        const leads = prospects.sort((a, b) => b.fit_score - a.fit_score).slice(0, limit)

        let added = 0
        for (const lead of leads) {
          const { error: insertError } = await supabase.from("leads").insert({
            search_id: search.id,
            company_name: lead.company_name,
            website: lead.website || lead.source_url,
            industry: lead.industry,
            location: lead.location,
            summary: lead.summary,
            pain_signals: lead.pain_signals,
            suggested_offer: lead.suggested_offer,
            fit_score: lead.fit_score,
            segment,
            source_url: lead.source_url,
          })
          // 23505 = already have this website; skip duplicates quietly.
          if (!insertError) added++
          else if (insertError.code !== "23505") console.error("Lead insert failed", insertError)
        }

        await supabase
          .from("lead_searches")
          .update({ status: "done", lead_count: added, finished_at: new Date().toISOString() })
          .eq("id", search.id)
        send({ type: "done", searchId: search.id, found: leads.length, added, vendors, outsideMarket })
      } catch (e) {
        const message = e instanceof Error ? e.message : "Lead search failed"
        await supabase
          .from("lead_searches")
          .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
          .eq("id", search.id)
        send({ type: "error", message })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } })
}
