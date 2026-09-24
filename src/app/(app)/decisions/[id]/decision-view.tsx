"use client"

import { ArrowLeftIcon, CheckIcon, MinusIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatDate, fromNow, initials, labelize } from "@/lib/format"
import type { JevVerdict } from "@/lib/ai/jev"
import type { JevAnalysis } from "@/lib/ai/tasks"
import type { Database } from "@/lib/supabase/database.types"

import { castVote, retractVote, saveOutcomeNotes, setDecisionWithdrawn } from "../actions"
import { DecisionStatusBadge } from "../decision-status-badge"
import { JevPanel } from "./jev-panel"

type Vote = Database["public"]["Tables"]["decision_votes"]["Row"]
type Choice = Vote["choice"]
type Decision = Database["public"]["Tables"]["decisions"]["Row"] & {
  idea: { id: string; title: string } | null
  author: { full_name: string | null } | null
  decision_votes: Vote[]
}

export function DecisionView({
  decision,
  founders,
  me,
  canVote,
  canManage,
  canAskJev,
  jevReady,
}: {
  decision: Decision
  founders: { id: string; full_name: string | null; email: string }[]
  me: string
  canVote: boolean
  canAskJev: boolean
  jevReady: boolean
  canManage: boolean
}) {
  const mine = decision.decision_votes.find((v) => v.voter_id === me)
  const [choice, setChoice] = useState<Choice>(mine?.choice ?? "approve")
  const [comment, setComment] = useState(mine?.comment ?? "")
  const [notes, setNotes] = useState(decision.outcome_notes ?? "")
  const [pending, startTransition] = useTransition()

  const approvals = decision.decision_votes.filter((v) => v.choice === "approve").length
  const rejections = decision.decision_votes.filter((v) => v.choice === "reject").length
  const needed = Math.floor(founders.length / 2) + 1
  const closed = decision.closes_at ? new Date(decision.closes_at) < new Date() : false
  const votingOpen = canVote && decision.status !== "withdrawn" && !closed

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) toast.error("Something went wrong", { description: r.error })
      else toast.success(success)
    })
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="self-start" render={<Link href="/decisions" />}>
        <ArrowLeftIcon data-icon="inline-start" />
        All decisions
      </Button>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DecisionStatusBadge status={decision.status} />
          {decision.idea && (
            <Badge variant="outline" render={<Link href={`/ideas/${decision.idea.id}`} />}>
              Idea: {decision.idea.title}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{decision.title}</h1>
        <p className="text-sm text-muted-foreground">
          Raised by {decision.author?.full_name ?? "a founder"} {fromNow(decision.created_at)}
          {decision.closes_at && ` · voting ${closed ? "closed" : "closes"} ${formatDate(decision.closes_at)}`}
          {decision.decided_at && ` · decided ${formatDate(decision.decided_at)}`}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <JevPanel
            decisionId={decision.id}
            verdict={decision.jev_verdict as JevVerdict | null}
            jevReady={jevReady}
            analysis={decision.jev_analysis as JevAnalysis | null}
            focus={decision.jev_focus}
            analyzedAt={decision.jev_analyzed_at}
            canAsk={canAskJev}
          />
          <Card>
            <CardHeader>
              <CardTitle>Context</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm leading-relaxed">
              <p className="whitespace-pre-wrap">{decision.description || "No context provided."}</p>
              {decision.options_considered && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Options considered</span>
                    <p className="whitespace-pre-wrap text-muted-foreground">{decision.options_considered}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Votes</CardTitle>
              <CardDescription>
                {needed} of {founders.length} voting members needed to approve or reject.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm">
                    Approve · {approvals}/{needed}
                  </span>
                  <Progress value={(approvals / needed) * 100} aria-label="Approvals" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm">
                    Reject · {rejections}/{needed}
                  </span>
                  <Progress value={(rejections / needed) * 100} aria-label="Rejections" />
                </div>
              </div>
              <Separator />
              <ul className="flex flex-col gap-3">
                {founders.map((f) => {
                  const vote = decision.decision_votes.find((v) => v.voter_id === f.id)
                  return (
                    <li key={f.id} className="flex items-start gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback>{initials(f.full_name ?? f.email)}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{f.full_name ?? f.email}</span>
                          {f.id === me && <span className="text-xs text-muted-foreground">(you)</span>}
                        </div>
                        {vote?.comment && <p className="text-sm text-muted-foreground">{vote.comment}</p>}
                      </div>
                      {vote ? (
                        <Badge
                          variant={
                            vote.choice === "approve"
                              ? "default"
                              : vote.choice === "reject"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {labelize(vote.choice)}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not voted</Badge>
                      )}
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          {canVote && (
            <Card>
              <CardHeader>
                <CardTitle>Your vote</CardTitle>
                <CardDescription>
                  {!votingOpen
                    ? decision.status === "withdrawn"
                      ? "This decision was withdrawn."
                      : "Voting has closed."
                    : mine
                      ? "You can change your vote until the decision closes."
                      : "Cast your vote with a short rationale."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ToggleGroup
                  value={[choice]}
                  onValueChange={(v) => v[0] && setChoice(v[0] as Choice)}
                  variant="outline"
                  disabled={!votingOpen}
                >
                  <ToggleGroupItem value="approve">
                    <CheckIcon />
                    Approve
                  </ToggleGroupItem>
                  <ToggleGroupItem value="reject">
                    <XIcon />
                    Reject
                  </ToggleGroupItem>
                  <ToggleGroupItem value="abstain">
                    <MinusIcon />
                    Abstain
                  </ToggleGroupItem>
                </ToggleGroup>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Why? (optional)"
                  rows={3}
                  disabled={!votingOpen}
                  aria-label="Vote comment"
                />
              </CardContent>
              <CardFooter className="gap-2">
                {mine && votingOpen && (
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => retractVote(decision.id), "Vote retracted")}
                  >
                    Retract
                  </Button>
                )}
                <Button
                  className="flex-1"
                  disabled={pending || !votingOpen}
                  onClick={() => run(() => castVote(decision.id, choice, comment), mine ? "Vote updated" : "Vote cast")}
                >
                  {mine ? "Update vote" : "Cast vote"}
                </Button>
              </CardFooter>
            </Card>
          )}

          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Outcome notes</CardTitle>
                <CardDescription>What was decided and what happens next.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  aria-label="Outcome notes"
                />
              </CardContent>
              <CardFooter className="justify-between gap-2">
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => setDecisionWithdrawn(decision.id, decision.status !== "withdrawn"),
                      decision.status === "withdrawn" ? "Decision reopened" : "Decision withdrawn"
                    )
                  }
                >
                  {decision.status === "withdrawn" ? "Reopen" : "Withdraw"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => run(() => saveOutcomeNotes(decision.id, notes), "Notes saved")}
                >
                  Save notes
                </Button>
              </CardFooter>
            </Card>
          ) : (
            decision.outcome_notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Outcome notes</CardTitle>
                </CardHeader>
                <CardContent className="text-sm whitespace-pre-wrap">{decision.outcome_notes}</CardContent>
              </Card>
            )
          )}
        </aside>
      </div>
    </>
  )
}
