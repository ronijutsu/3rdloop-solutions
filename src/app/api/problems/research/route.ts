import { z } from "zod"

import { aiConfigured } from "@/lib/ai/client"
import { extractProblems, planProblemSearch } from "@/lib/ai/tasks"
import { getMember } from "@/lib/auth"
import { crawl, crawlerConfigured, searchSnippets, searchWeb } from "@/lib/crawl4ai"
import { storeSourceScreenshot } from "@/lib/problem-evidence"

export const maxDuration = 300

const Body = z.object({
  topic: z.string().trim().min(5, "Describe the idea or problem in a few words"),
  ideaId: z.uuid().nullable().default(null),
  limit: z.number().int().min(2).max(10).default(8),
})

export type ProblemResearchEvent =
  | { type: "status"; message: string }
  | { type: "done"; found: number; added: number }
  | { type: "error"; message: string }

// Result pages that never carry readable first-hand problems (video, shops, or login walls).
const SKIP = [
  "youtube.com",
  "pinterest.",
  "amazon.",
  "lazada.",
  "shopee.",
  "wikipedia.org",
  "facebook.com",
  "instagram.com",
]

export async function POST(request: Request) {
  const { supabase, profile, permissions } = await getMember()
  if (!profile || profile.role === "disabled") return new Response("Unauthorized", { status: 401 })
  if (!permissions.has("problems.edit") || !permissions.has("ai.use")) {
    return Response.json({ error: "Your role doesn't allow researching problems." }, { status: 403 })
  }
  if (!aiConfigured()) return Response.json({ error: "OPENROUTER_API_KEY is not set" }, { status: 503 })
  if (!crawlerConfigured()) return Response.json({ error: "CRAWL4AI_URL is not set" }, { status: 503 })

  const parsed = Body.safeParse(await request.json())
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { topic, ideaId, limit } = parsed.data

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ProblemResearchEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      try {
        send({ type: "status", message: "Planning searches for people describing this problem…" })
        const plan = await planProblemSearch(topic)
        send({ type: "status", message: "Searching forums, reviews, and communities…" })
        const [snippets, urls] = await Promise.all([
          searchSnippets(plan.queries),
          searchWeb(plan.queries, limit, { exclude: [...SKIP, "reddit.com"] }),
        ])
        if (snippets.length === 0 && urls.length === 0) {
          throw new Error("No discussions found. Try describing the problem differently.")
        }

        send({ type: "status", message: `Reading ${urls.length} pages and ${snippets.length} discussion snippets…` })
        const crawled = await crawl(urls).catch(() => [])
        if (snippets.length === 0 && crawled.length === 0)
          throw new Error("Couldn't read any of the discussions found.")

        send({ type: "status", message: "Extracting evidenced problems…" })
        // Reddit and social sites block crawlers, so their indexed snippets are the evidence.
        // Snippets and full pages are qualified in separate, smaller batches; free models do better that way.
        const batches = [snippets.map((r) => ({ url: r.url, title: r.title, markdown: r.snippet })), crawled].filter(
          (batch) => batch.length > 0
        )
        const found = (await Promise.all(batches.map((batch) => extractProblems(topic, batch).catch(() => [])))).flat()
        const seen = new Set<string>()
        const problems = found.filter((p) => {
          const key = p.title.toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        let added = 0
        const inserted: { id: string; source_url: string | null }[] = []
        for (const p of problems) {
          const { data, error } = await supabase
            .from("problems")
            .insert({
              title: p.title,
              description: p.description,
              who_has_it: p.who_has_it,
              evidence: p.evidence,
              source_url: p.source_url,
              source_title: p.source_title || null,
              source_type: p.source_type,
              frequency: p.frequency,
              severity: p.severity,
              willingness_to_pay: p.willingness_to_pay,
              idea_id: ideaId,
            })
            .select("id, source_url")
            .single()
          if (!error && data) {
            added++
            inserted.push(data)
          }
        }

        if (inserted.length) {
          send({
            type: "status",
            message: `Capturing ${inserted.length} source screenshot${inserted.length === 1 ? "" : "s"}…`,
          })
          await Promise.all(inserted.map((p) => storeSourceScreenshot(supabase, p).catch(() => false)))
        }
        send({ type: "done", found: problems.length, added })
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "Research failed" })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } })
}
