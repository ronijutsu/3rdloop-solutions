import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { aiConfigured } from "@/lib/ai/client"
import { requirePermission } from "@/lib/auth"

import { SurveyBuilder } from "./survey-builder"

export const metadata: Metadata = { title: "Survey" }

export default async function SurveyPage({ params }: PageProps<"/surveys/[id]">) {
  const { id } = await params
  const { supabase, can } = await requirePermission("surveys.view")
  const [{ data: survey }, { data: questions }, { data: responses }] = await Promise.all([
    supabase.from("surveys").select("*").eq("id", id).single(),
    supabase.from("survey_questions").select("*").eq("survey_id", id).order("position"),
    supabase.from("survey_responses").select("*").eq("survey_id", id).order("created_at", { ascending: false }),
  ])
  if (!survey) notFound()

  return (
    <SurveyBuilder
      survey={survey}
      questions={questions ?? []}
      responses={responses ?? []}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
      aiEnabled={aiConfigured() && can("ai.use")}
      editable={can("surveys.edit")}
    />
  )
}
