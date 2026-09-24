import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { requirePermission } from "@/lib/auth"
import { fromNow, labelize } from "@/lib/format"
import { BUILD_STEP, stepInfo } from "@/lib/playbook"

export const metadata: Metadata = { title: "Idea Incubator" }

export default async function IdeasPage() {
  const { supabase, can } = await requirePermission("ideas.view")
  const { data: ideas } = await supabase
    .from("ideas")
    .select("*, idea_questions(required, answer)")
    .order("updated_at", { ascending: false })

  return (
    <>
      <PageHeader
        title="Idea Incubator"
        description="Every idea runs the 10-step playbook. Required questions must be answered before an idea can advance — and before anything gets built."
        actions={
          can("ideas.edit") && (
            <Button render={<Link href="/ideas/new" />}>
              <PlusIcon data-icon="inline-start" />
              New idea
            </Button>
          )
        }
      />
      {!ideas?.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No ideas yet</EmptyTitle>
            <EmptyDescription>Capture your first idea as a testable hypothesis.</EmptyDescription>
          </EmptyHeader>
          {can("ideas.edit") && (
            <EmptyContent>
              <Button render={<Link href="/ideas/new" />}>New idea</Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ideas.map((idea) => {
            const required = idea.idea_questions.filter((q) => q.required)
            const open = required.filter((q) => !q.answer).length
            const step = stepInfo(idea.stage)
            return (
              <Link key={idea.id} href={`/ideas/${idea.id}`} className="group flex">
                <Card className="flex-1 transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        Step {idea.stage} · {step.phase}
                      </Badge>
                      {idea.status !== "active" && <Badge variant="outline">{labelize(idea.status)}</Badge>}
                      {idea.stage >= BUILD_STEP && <Badge>Building</Badge>}
                    </div>
                    <CardTitle className="mt-2 line-clamp-2">{idea.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{idea.problem ?? step.title}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <Progress value={(idea.stage / 10) * 100} aria-label="Playbook progress" />
                  </CardContent>
                  <CardFooter className="mt-auto justify-between text-xs text-muted-foreground">
                    <span>{open > 0 ? `${open} open question${open === 1 ? "" : "s"}` : "All questions answered"}</span>
                    <span suppressHydrationWarning>Updated {fromNow(idea.updated_at)}</span>
                  </CardFooter>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
