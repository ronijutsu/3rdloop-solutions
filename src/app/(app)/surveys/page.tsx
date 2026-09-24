import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { aiConfigured } from "@/lib/ai/client"
import { requirePermission } from "@/lib/auth"
import { fromNow, labelize } from "@/lib/format"

import { NewSurveyDialog } from "./new-survey-dialog"

export const metadata: Metadata = { title: "Surveyor" }

export default async function SurveysPage() {
  const { supabase, can } = await requirePermission("surveys.view")
  const [{ data: surveys }, { data: ideas }] = await Promise.all([
    supabase
      .from("surveys")
      .select("*, idea:ideas(title), survey_questions(count), survey_responses(count)")
      .order("created_at", { ascending: false }),
    supabase.from("ideas").select("id, title").order("title"),
  ])

  return (
    <>
      <PageHeader
        title="Surveyor"
        description="Customer-discovery surveys that ask about past behaviour, not hypotheticals. Share a public link and read the results here."
        actions={
          can("surveys.edit") && <NewSurveyDialog ideas={ideas ?? []} aiEnabled={aiConfigured() && can("ai.use")} />
        }
      />
      {!surveys?.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No surveys yet</EmptyTitle>
            <EmptyDescription>Create one to validate a problem before you build.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {surveys.map((s) => (
            <Link key={s.id} href={`/surveys/${s.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardHeader>
                  <div className="flex gap-2">
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>{labelize(s.status)}</Badge>
                    {s.idea && <Badge variant="outline">{s.idea.title}</Badge>}
                  </div>
                  <CardTitle className="mt-2">{s.title}</CardTitle>
                  {s.description && <CardDescription className="line-clamp-2">{s.description}</CardDescription>}
                </CardHeader>
                <CardFooter className="mt-auto justify-between text-xs text-muted-foreground">
                  <span>
                    {s.survey_questions[0]?.count ?? 0} questions · {s.survey_responses[0]?.count ?? 0} responses
                  </span>
                  <span>{fromNow(s.created_at)}</span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
