import { format, startOfMonth } from "date-fns"
import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { requireMember } from "@/lib/auth"
import { formatDate, formatMoney, labelize } from "@/lib/format"
import { BUILD_STEP, stepInfo } from "@/lib/playbook"

export default async function DashboardPage() {
  const { supabase, profile, can } = await requireMember()
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd")

  const [
    { data: decisions },
    { data: ideas },
    { data: deals },
    { data: tasks },
    { data: followUps },
    { data: content },
    { data: transactions },
    { data: objectives },
    { count: newLeads },
  ] = await Promise.all([
    supabase.from("decisions").select("id, title, closes_at, decision_votes(voter_id)").eq("status", "open"),
    supabase
      .from("ideas")
      .select("id, title, stage, idea_questions(required, answer, stage)")
      .eq("status", "active")
      .order("updated_at", { ascending: false }),
    supabase.from("deals").select("value, stage:pipeline_stages(kind, probability)"),
    supabase
      .from("tasks")
      .select("id, title, due_date, priority, project:projects(id, name), task_assignees!inner(profile_id)")
      .eq("task_assignees.profile_id", profile.id)
      .neq("status", "done")
      .is("archived_at", null)
      .order("due_date", { nullsFirst: false })
      .limit(6),
    supabase
      .from("network_contacts")
      .select("id, full_name, organization, next_follow_up")
      .lte("next_follow_up", today)
      .order("next_follow_up")
      .limit(5),
    supabase
      .from("content_items")
      .select("id, title, channel, publish_date, status")
      .gte("publish_date", today)
      .neq("status", "published")
      .order("publish_date")
      .limit(5),
    supabase.from("transactions").select("kind, amount").gte("occurred_on", monthStart),
    supabase
      .from("objectives")
      .select("id, title, key_results(start_value, target_value, current_value)")
      .neq("status", "done")
      .limit(4),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
  ])

  const needsVote = (decisions ?? []).filter((d) => !d.decision_votes.some((v) => v.voter_id === profile.id))
  const openDeals = (deals ?? []).filter((d) => d.stage?.kind === "open")
  const pipelineValue = openDeals.reduce((s, d) => s + Number(d.value), 0)
  const weighted = openDeals.reduce((s, d) => s + Number(d.value) * ((d.stage?.probability ?? 0) / 100), 0)
  const net = (transactions ?? []).reduce((s, t) => s + (t.kind === "income" ? 1 : -1) * Number(t.amount), 0)

  const firstName = (profile.full_name ?? profile.email).split(" ")[0]

  return (
    <>
      <PageHeader title={`Hi ${firstName}`} description={format(new Date(), "EEEE, MMMM d")} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {can("crm.view") && (
          <Tile
            label="Open pipeline"
            value={formatMoney(pipelineValue)}
            hint={`${formatMoney(Math.round(weighted))} weighted`}
            href="/crm"
          />
        )}
        {can("finance.view") && (
          <Tile label="Net this month" value={formatMoney(net)} hint="Income minus expenses" href="/finance" />
        )}
        {can("decisions.vote") && (
          <Tile
            label="Awaiting your vote"
            value={String(needsVote.length)}
            hint={`${decisions?.length ?? 0} open decisions`}
            href="/decisions"
          />
        )}
        {can("leads.view") && <Tile label="New leads" value={String(newLeads ?? 0)} hint="To review" href="/leads" />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {can("ideas.view") && (
          <Card>
            <CardHeader>
              <CardTitle>Ideas in the playbook</CardTitle>
              <CardDescription>Open questions block each idea from advancing.</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" render={<Link href="/ideas" />}>
                  All <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!ideas?.length && <Muted>No active ideas. Capture one in the Idea Incubator.</Muted>}
              {ideas?.slice(0, 5).map((idea) => {
                const open = idea.idea_questions.filter((q) => q.required && !q.answer && q.stage <= idea.stage).length
                return (
                  <Link
                    key={idea.id}
                    href={`/ideas/${idea.id}`}
                    className="flex flex-col gap-1.5 rounded-lg p-1 hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{idea.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Step {idea.stage}: {stepInfo(idea.stage).title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress value={idea.stage * 10} className="flex-1" aria-label={`${idea.title} progress`} />
                      {open > 0 ? (
                        <Badge variant="outline">{open} blocking</Badge>
                      ) : idea.stage >= BUILD_STEP ? (
                        <Badge>Building</Badge>
                      ) : (
                        <Badge variant="secondary">Ready to advance</Badge>
                      )}
                    </div>
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        )}

        {can("decisions.vote") && (
          <Card>
            <CardHeader>
              <CardTitle>Decisions needing your vote</CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" render={<Link href="/decisions" />}>
                  All <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {needsVote.length === 0 && <Muted>You&apos;re all caught up.</Muted>}
              {needsVote.map((d) => (
                <Row
                  key={d.id}
                  href={`/decisions/${d.id}`}
                  title={d.title}
                  meta={d.closes_at ? `Closes ${formatDate(d.closes_at)}` : "No deadline"}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {can("planning.view") && (
          <Card>
            <CardHeader>
              <CardTitle>Your tasks</CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" render={<Link href="/projects" />}>
                  Projects <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {!tasks?.length && <Muted>No open tasks assigned to you.</Muted>}
              {tasks?.map((t) => (
                <Row
                  key={t.id}
                  href={`/projects/${t.project?.id}/tasks/${t.id}`}
                  title={t.title}
                  meta={`${t.project?.name ?? ""}${t.due_date ? ` · due ${formatDate(t.due_date, "MMM d")}` : ""}`}
                  badge={t.priority === "urgent" || t.priority === "high" ? labelize(t.priority) : undefined}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {can("planning.view") && (
          <Card>
            <CardHeader>
              <CardTitle>Goals</CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" render={<Link href="/okrs" />}>
                  OKRs <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!objectives?.length && <Muted>No active objectives.</Muted>}
              {objectives?.map((o) => {
                const pct = o.key_results.length
                  ? o.key_results.reduce((s, kr) => {
                      const span = Number(kr.target_value) - Number(kr.start_value)
                      const p = span ? (Number(kr.current_value) - Number(kr.start_value)) / span : 0
                      return s + Math.max(0, Math.min(1, p))
                    }, 0) / o.key_results.length
                  : 0
                return (
                  <div key={o.id} className="flex flex-col gap-1.5">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate">{o.title}</span>
                      <span className="text-muted-foreground tabular-nums">{Math.round(pct * 100)}%</span>
                    </div>
                    <Progress value={pct * 100} aria-label={o.title} />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {can("network.view") && (
          <Card>
            <CardHeader>
              <CardTitle>Follow-ups due</CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" render={<Link href="/network" />}>
                  Network <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {!followUps?.length && <Muted>No follow-ups due.</Muted>}
              {followUps?.map((p) => (
                <Row
                  key={p.id}
                  href="/network"
                  title={p.full_name}
                  meta={`${p.organization ?? ""} · ${formatDate(p.next_follow_up, "MMM d")}`}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {can("content.view") && (
          <Card>
            <CardHeader>
              <CardTitle>Upcoming content</CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" render={<Link href="/content" />}>
                  Planner <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {!content?.length && <Muted>Nothing scheduled.</Muted>}
              {content?.map((c) => (
                <Row
                  key={c.id}
                  href="/content"
                  title={c.title}
                  meta={`${labelize(c.channel)} · ${formatDate(c.publish_date, "MMM d")}`}
                  badge={labelize(c.status)}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function Tile({ label, value, hint, href }: { label: string; value: string; hint: string; href: string }) {
  return (
    <Link href={href} className="group">
      <Card size="sm" className="h-full transition-colors group-hover:border-primary/40">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
      </Card>
    </Link>
  )
}

function Row({ href, title, meta, badge }: { href: string; title: string; meta: string; badge?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-md px-1 py-1.5 text-sm hover:bg-muted/50"
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{meta}</span>
      </div>
      {badge && <Badge variant="outline">{badge}</Badge>}
    </Link>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}
