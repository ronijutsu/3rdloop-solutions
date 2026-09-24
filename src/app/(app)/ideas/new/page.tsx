import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { aiConfigured } from "@/lib/ai/client"
import { problemToHypothesis } from "@/lib/ai/tasks"
import { requirePermission } from "@/lib/auth"

import { HypothesisForm } from "../hypothesis-form"

export const metadata: Metadata = { title: "New idea" }

export default async function NewIdeaPage({ searchParams }: PageProps<"/ideas/new">) {
  const { supabase, can } = await requirePermission("ideas.edit")
  const { problem } = await searchParams

  // Pre-fill from a Problem Hunter entry when promoted from there.
  let initial: Record<string, string | null> | undefined
  if (typeof problem === "string") {
    const { data } = await supabase.from("problems").select("title, description, who_has_it").eq("id", problem).single()
    if (data) {
      initial = { title: data.title, problem: data.description, target_customer: data.who_has_it }
      if (aiConfigured() && can("ai.use")) {
        // Let AI draft the full hypothesis; founders edit before saving.
        initial = await problemToHypothesis(data).catch(() => initial)
      }
      initial = { ...initial, problem_id: problem }
    }
  }

  return (
    <>
      <PageHeader
        title="Capture an idea"
        description="Step 1 of the playbook: write the idea as a hypothesis you can prove wrong."
      />
      <HypothesisForm initial={initial} aiEnabled={aiConfigured() && can("ai.use")} />
    </>
  )
}
