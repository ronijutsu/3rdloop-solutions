import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { requirePermission } from "@/lib/auth"
import { formatDate, fromNow, labelize } from "@/lib/format"

import { DecisionStatusBadge } from "./decision-status-badge"
import { NewDecisionDialog } from "./new-decision-dialog"
import { StatusTabs } from "./status-tabs"

export const metadata: Metadata = { title: "Decisions" }

export default async function DecisionsPage({ searchParams }: PageProps<"/decisions">) {
  const { supabase, profile, can } = await requirePermission("decisions.view")
  const { idea, view = "open" } = await searchParams

  const [{ data: decisions }, { data: ideas }, { data: voters }] = await Promise.all([
    supabase
      .from("decisions")
      .select("*, idea:ideas(id, title), decision_votes(voter_id, choice)")
      .order("created_at", { ascending: false }),
    supabase.from("ideas").select("id, title").order("title"),
    supabase.rpc("voting_member_count"),
  ])

  const list = (decisions ?? []).filter((d) =>
    view === "all" ? true : view === "open" ? d.status === "open" : d.status !== "open"
  )

  return (
    <>
      <PageHeader
        title="Decisions"
        description={`Voting members approve or reject. A decision passes when a majority of the ${voters ?? 0} voting members agree.`}
        actions={
          can("decisions.create") && (
            <NewDecisionDialog ideas={ideas ?? []} defaultIdea={typeof idea === "string" ? idea : undefined} />
          )
        }
      />
      <StatusTabs view={String(view)} />
      {list.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Nothing here</EmptyTitle>
            <EmptyDescription>
              {view === "open"
                ? "No open decisions. Raise one when you need the team's call."
                : "No decisions in this view."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((d) => {
            const approvals = d.decision_votes.filter((v) => v.choice === "approve").length
            const rejections = d.decision_votes.filter((v) => v.choice === "reject").length
            const mine = d.decision_votes.find((v) => v.voter_id === profile.id)
            return (
              <Link key={d.id} href={`/decisions/${d.id}`} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <DecisionStatusBadge status={d.status} />
                      {d.idea && <Badge variant="outline">{d.idea.title}</Badge>}
                      {d.status === "open" && !mine && can("decisions.vote") && (
                        <Badge variant="secondary">Needs your vote</Badge>
                      )}
                    </div>
                    <CardTitle className="mt-2">{d.title}</CardTitle>
                    {d.description && <CardDescription className="line-clamp-2">{d.description}</CardDescription>}
                  </CardHeader>
                  <CardFooter className="justify-between text-xs text-muted-foreground">
                    <span>
                      {approvals} approve · {rejections} reject · {d.decision_votes.length}/{voters ?? 0} voted
                      {mine && ` · you: ${labelize(mine.choice)}`}
                    </span>
                    <span>{d.closes_at ? `Closes ${formatDate(d.closes_at)}` : fromNow(d.created_at)}</span>
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
