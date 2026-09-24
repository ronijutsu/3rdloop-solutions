import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { createClient } from "@/lib/supabase/server"

import { SurveyForm } from "./survey-form"

export const metadata: Metadata = { title: "Survey", robots: { index: false } }

export default async function PublicSurveyPage({ params }: PageProps<"/s/[id]">) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: survey }, { data: questions }] = await Promise.all([
    supabase.from("surveys").select("id, title, description, status").eq("id", id).single(),
    supabase.from("survey_questions").select("*").eq("survey_id", id).order("position"),
  ])
  if (!survey) notFound()

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 py-10 sm:py-16">
      <div className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </div>
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{survey.title}</h1>
        {survey.description && (
          <p className="max-w-prose text-lg leading-relaxed text-pretty text-muted-foreground">{survey.description}</p>
        )}
      </header>
      {survey.status !== "active" ? (
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-8">
          <p className="font-medium">This survey is closed.</p>
          <p className="text-sm text-muted-foreground">
            It isn&apos;t accepting responses right now. Thanks for stopping by.
          </p>
        </div>
      ) : (
        <SurveyForm surveyId={survey.id} questions={questions ?? []} />
      )}
    </main>
  )
}
