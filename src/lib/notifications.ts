import "server-only"

import { addDays, format } from "date-fns"

import { taskCode } from "@/lib/agile"
import type { requireMember } from "@/lib/auth"
import { formatMoney } from "@/lib/format"

type Member = Awaited<ReturnType<typeof requireMember>>

export type NotificationKind =
  | "task_due"
  | "task_overdue"
  | "task_assigned"
  | "task_note"
  | "decision_new"
  | "decision_closing"
  | "decision_result"
  | "budget_proposed"
  | "milestone_due"
  | "follow_up"
  | "content_due"

export type Notification = {
  /** Stable id for read tracking; includes the date/status it's about. */
  key: string
  kind: NotificationKind
  title: string
  detail: string
  href: string
  /** When it happened or is due (ISO), used for ordering. */
  at: string
  tone: "info" | "warning" | "danger" | "success"
  read: boolean
}

const ymd = (d: Date) => format(d, "yyyy-MM-dd")
const endOfDay = (date: string) => `${date}T23:59:59`

/**
 * Everything that needs this person's attention, computed from live data. Each source only runs when the
 * person may see that module; RLS still applies to every query.
 */
export async function getNotifications({ supabase, profile, can }: Member): Promise<Notification[]> {
  const me = profile.id
  const today = ymd(new Date())
  const soon = ymd(addDays(new Date(), 3))
  const weekAgo = addDays(new Date(), -7).toISOString()
  const items: Omit<Notification, "read">[] = []
  const jobs: PromiseLike<void>[] = []

  if (can("planning.view")) {
    // My open tasks that are due within 3 days or overdue.
    jobs.push(
      supabase
        .from("tasks")
        .select("id, number, title, due_date, project_id, project:projects(key), task_assignees!inner(profile_id)")
        .eq("task_assignees.profile_id", me)
        .neq("status", "done")
        .is("archived_at", null)
        .lte("due_date", soon)
        .limit(30)
        .then(({ data }) => {
          for (const t of data ?? []) {
            if (!t.due_date) continue
            const overdue = t.due_date < today
            items.push({
              key: `task-due:${t.id}:${t.due_date}`,
              kind: overdue ? "task_overdue" : "task_due",
              title: overdue
                ? `Overdue: ${t.title}`
                : t.due_date === today
                  ? `Due today: ${t.title}`
                  : `Due soon: ${t.title}`,
              detail: `${taskCode(t.project?.key ?? "", t.number)} · due ${format(new Date(`${t.due_date}T00:00:00`), "MMM d")}`,
              href: `/projects/${t.project_id}/tasks/${t.id}`,
              at: endOfDay(t.due_date),
              tone: overdue ? "danger" : "warning",
            })
          }
        })
    )
    // Tasks assigned to me in the last week (that I didn't create myself).
    jobs.push(
      supabase
        .from("task_assignees")
        .select(
          "created_at, task:tasks!inner(id, number, title, created_by, project_id, status, project:projects(key))"
        )
        .eq("profile_id", me)
        .gte("created_at", weekAgo)
        .limit(30)
        .then(({ data }) => {
          for (const a of data ?? []) {
            const t = a.task
            if (!t || t.created_by === me || t.status === "done") continue
            items.push({
              key: `task-assigned:${t.id}:${a.created_at}`,
              kind: "task_assigned",
              title: `Assigned to you: ${t.title}`,
              detail: taskCode(t.project?.key ?? "", t.number),
              href: `/projects/${t.project_id}/tasks/${t.id}`,
              at: a.created_at,
              tone: "info",
            })
          }
        })
    )
    // Notes others posted on my tasks this week.
    jobs.push(
      supabase
        .from("task_notes")
        .select(
          "id, created_at, author:profiles(full_name, email), task:tasks!inner(id, number, title, project_id, project:projects(key), task_assignees!inner(profile_id))"
        )
        .eq("task.task_assignees.profile_id", me)
        .neq("author_id", me)
        .gte("created_at", weekAgo)
        .limit(20)
        .then(({ data }) => {
          for (const n of data ?? []) {
            const t = n.task
            if (!t) continue
            items.push({
              key: `task-note:${n.id}`,
              kind: "task_note",
              title: `${n.author?.full_name ?? n.author?.email ?? "Someone"} posted a note`,
              detail: `${taskCode(t.project?.key ?? "", t.number)} · ${t.title}`,
              href: `/projects/${t.project_id}/tasks/${t.id}`,
              at: n.created_at,
              tone: "info",
            })
          }
        })
    )
    // Roadmap milestones I own that are due soon or overdue.
    jobs.push(
      supabase
        .from("roadmap_milestones")
        .select("id, title, due_date, item:roadmap_items!inner(id, title, owner_id)")
        .eq("item.owner_id", me)
        .eq("done", false)
        .lte("due_date", soon)
        .limit(20)
        .then(({ data }) => {
          for (const m of data ?? []) {
            if (!m.due_date || !m.item) continue
            const overdue = m.due_date < today
            items.push({
              key: `milestone:${m.id}:${m.due_date}`,
              kind: "milestone_due",
              title: `${overdue ? "Overdue milestone" : "Milestone due"}: ${m.title}`,
              detail: m.item.title,
              href: `/roadmap/${m.item.id}`,
              at: endOfDay(m.due_date),
              tone: overdue ? "danger" : "warning",
            })
          }
        })
    )
  }

  if (can("decisions.view")) {
    jobs.push(
      supabase
        .from("decisions")
        .select("id, title, status, created_at, created_by, closes_at, decided_at, decision_votes(voter_id)")
        .or(`status.eq.open,decided_at.gte.${weekAgo}`)
        .order("created_at", { ascending: false })
        .limit(40)
        .then(({ data }) => {
          const canVote = can("decisions.vote")
          const closingBy = addDays(new Date(), 2).toISOString()
          for (const d of data ?? []) {
            const voted = d.decision_votes.some((v) => v.voter_id === me)
            if (d.status === "open") {
              if (!canVote || voted) continue
              const closing = d.closes_at && d.closes_at <= closingBy
              items.push({
                key: closing ? `decision-closing:${d.id}` : `decision-new:${d.id}`,
                kind: closing ? "decision_closing" : "decision_new",
                title: closing ? `Voting closes soon: ${d.title}` : `New decision needs your vote`,
                detail: closing ? `Closes ${format(new Date(d.closes_at!), "MMM d, h:mm a")}` : d.title,
                href: `/decisions/${d.id}`,
                at: closing ? d.closes_at! : d.created_at,
                tone: closing ? "warning" : "info",
              })
            } else if (d.decided_at && (d.status === "approved" || d.status === "rejected")) {
              items.push({
                key: `decision-result:${d.id}:${d.status}`,
                kind: "decision_result",
                title: `Decision ${d.status}: ${d.title}`,
                detail: `Decided ${format(new Date(d.decided_at), "MMM d")}`,
                href: `/decisions/${d.id}`,
                at: d.decided_at,
                tone: d.status === "approved" ? "success" : "info",
              })
            }
          }
        })
    )
  }

  if (can("finance.view")) {
    jobs.push(
      supabase
        .from("budgets")
        .select("id, month, created_at, created_by, budget_lines(amount)")
        .eq("status", "proposed")
        .limit(10)
        .then(({ data }) => {
          for (const b of data ?? []) {
            if (b.created_by === me) continue
            const total = b.budget_lines.reduce((n, l) => n + Number(l.amount), 0)
            items.push({
              key: `budget:${b.id}`,
              kind: "budget_proposed",
              title: `Budget proposed for ${format(new Date(`${b.month}T00:00:00`), "MMMM yyyy")}`,
              detail: `${formatMoney(total)} total · review and vote`,
              href: "/finance?tab=budget",
              at: b.created_at,
              tone: "info",
            })
          }
        })
    )
  }

  if (can("network.view")) {
    jobs.push(
      supabase
        .from("network_contacts")
        .select("id, full_name, organization, next_follow_up")
        .lte("next_follow_up", today)
        .limit(10)
        .then(({ data }) => {
          for (const c of data ?? []) {
            if (!c.next_follow_up) continue
            items.push({
              key: `follow-up:${c.id}:${c.next_follow_up}`,
              kind: "follow_up",
              title: `Follow up with ${c.full_name}`,
              detail: c.organization ?? `Planned for ${format(new Date(`${c.next_follow_up}T00:00:00`), "MMM d")}`,
              href: "/network",
              at: endOfDay(c.next_follow_up),
              tone: c.next_follow_up < today ? "warning" : "info",
            })
          }
        })
    )
  }

  if (can("content.view")) {
    jobs.push(
      supabase
        .from("content_items")
        .select("id, title, publish_date, status")
        .eq("owner_id", me)
        .neq("status", "published")
        .gte("publish_date", today)
        .lte("publish_date", soon)
        .limit(10)
        .then(({ data }) => {
          for (const c of data ?? []) {
            if (!c.publish_date) continue
            items.push({
              key: `content:${c.id}:${c.publish_date}`,
              kind: "content_due",
              title: `Publishing soon: ${c.title}`,
              detail: `Planned for ${format(new Date(`${c.publish_date}T00:00:00`), "MMM d")} · ${c.status}`,
              href: "/content",
              at: endOfDay(c.publish_date),
              tone: "info",
            })
          }
        })
    )
  }

  await Promise.all(jobs)

  const keys = items.map((i) => i.key)
  const { data: reads } = keys.length
    ? await supabase.from("notification_reads").select("key").eq("profile_id", me).in("key", keys)
    : { data: [] }
  const read = new Set((reads ?? []).map((r) => r.key))

  // Unread first, then most urgent / most recent.
  return items
    .map((i) => ({ ...i, read: read.has(i.key) }))
    .sort((a, b) => Number(a.read) - Number(b.read) || b.at.localeCompare(a.at))
    .slice(0, 50)
}
