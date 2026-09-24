import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { aiConfigured } from "@/lib/ai/client"
import { requirePermission } from "@/lib/auth"

import { IdeaWorkspace } from "./idea-workspace"

export const metadata: Metadata = { title: "Idea" }

export default async function IdeaPage({ params, searchParams }: PageProps<"/ideas/[id]">) {
  const { id } = await params
  const { step } = await searchParams
  const { supabase, can } = await requirePermission("ideas.view")

  const [{ data: idea }, { data: questions }, { data: reviews }, { data: decisions }, { data: documents }] =
    await Promise.all([
      supabase.from("ideas").select("*").eq("id", id).single(),
      supabase
        .from("idea_questions")
        .select("*, answerer:profiles!idea_questions_answered_by_fkey(full_name)")
        .eq("idea_id", id)
        .order("stage")
        .order("position"),
      supabase
        .from("idea_stage_reviews")
        .select("*, author:profiles(full_name)")
        .eq("idea_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("decisions")
        .select("id, title, status")
        .eq("idea_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("documents")
        .select("id, title, updated_at")
        .eq("idea_id", id)
        .order("updated_at", { ascending: false }),
    ])

  if (!idea) notFound()

  const selected = Number(step) >= 1 && Number(step) <= 10 ? Number(step) : idea.stage

  return (
    <IdeaWorkspace
      idea={idea}
      questions={questions ?? []}
      reviews={reviews ?? []}
      decisions={decisions ?? []}
      documents={documents ?? []}
      selectedStep={selected}
      aiEnabled={aiConfigured() && can("ai.use")}
    />
  )
}
