import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { aiConfigured } from "@/lib/ai/client"
import { requirePermission } from "@/lib/auth"
import { crawlerConfigured } from "@/lib/crawl4ai"

import { ProblemBoard } from "./problem-board"
import { ProblemResearch } from "./problem-research"

export const metadata: Metadata = { title: "Problem Hunter" }

export default async function ProblemsPage() {
  const { supabase, can } = await requirePermission("problems.view")
  const [{ data: problems }, { data: ideas }] = await Promise.all([
    supabase.from("problems").select("*, idea:ideas(id, title)").order("created_at", { ascending: false }),
    supabase.from("ideas").select("id, title, problem, target_customer").eq("status", "active").order("title"),
  ])

  // Screenshots live in a private bucket; sign them for this page view.
  const paths = (problems ?? []).flatMap((p) => (p.screenshot_path ? [p.screenshot_path] : []))
  const { data: signed } = paths.length
    ? await supabase.storage.from("evidence").createSignedUrls(paths, 3600)
    : { data: [] }
  const screenshotUrl = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl]] : [])))

  const scored = (problems ?? [])
    .map((p) => ({
      ...p,
      score: (p.frequency ?? 0) * (p.severity ?? 0) * (p.willingness_to_pay ?? 0),
      screenshot_url: p.screenshot_path ? (screenshotUrl.get(p.screenshot_path) ?? null) : null,
    }))
    .sort((a, b) => b.score - a.score)

  return (
    <>
      <PageHeader
        title="Problem Hunter"
        description="Log real problems you spot in interviews, forums, reviews, and the field. Score them, then promote the best into the Idea Incubator."
      />
      {can("problems.edit") && can("ai.use") && (
        <ProblemResearch ideas={ideas ?? []} ready={aiConfigured() && crawlerConfigured()} />
      )}
      <ProblemBoard problems={scored} />
    </>
  )
}
