import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns"

import type { Database } from "@/lib/supabase/database.types"

type Tables = Database["public"]["Tables"]
export type Sprint = Tables["sprints"]["Row"]
export type TaskRow = Tables["tasks"]["Row"]
export type Person = { id: string; full_name: string | null; email: string; avatar_url?: string | null }

export const STATUSES = ["todo", "in_progress", "review", "done"] as const
export type Status = (typeof STATUSES)[number]
export const STATUS_LABEL: Record<Status, string> = {
  todo: "To do",
  in_progress: "In progress",
  review: "In review",
  done: "Done",
}
export const STATUS_VARIANT = {
  todo: "outline",
  in_progress: "secondary",
  review: "secondary",
  done: "default",
} as const

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const
export const PRIORITY_VARIANT = { low: "outline", medium: "secondary", high: "default", urgent: "destructive" } as const

export const KINDS = ["story", "task", "bug", "spike", "chore", "deliverable"] as const
export const FREQUENCIES = ["once", "daily", "weekly", "biweekly", "monthly", "quarterly"] as const
export const TEAMS = ["Product", "Engineering", "Design", "Sales", "Marketing", "Operations", "Finance"] as const
/** Fibonacci-ish planning-poker values. */
export const POINTS = [0, 1, 2, 3, 5, 8, 13, 21] as const

export function taskCode(key: string, number: number) {
  return `${key}-${String(number).padStart(3, "0")}`
}

export type StatusEvent = { task_id: string; at: string; status: Status }

/**
 * Rebuild each task's status over time from the activity log: the "created" entry gives the starting status and
 * every status change after it moves the task. Returns, per task, the sorted list of (time, status) points.
 */
export function statusTimelines(
  activity: { task_id: string; action: string; detail: unknown; created_at: string }[]
): Map<string, StatusEvent[]> {
  const byTask = new Map<string, StatusEvent[]>()
  for (const a of activity) {
    const d = (a.detail ?? {}) as Record<string, unknown>
    let status: unknown
    if (a.action === "created") status = d.status
    else if (a.action === "changed" && d.field === "status") status = d.to
    if (typeof status !== "string" || !STATUSES.includes(status as Status)) continue
    const list = byTask.get(a.task_id) ?? []
    list.push({ task_id: a.task_id, at: a.created_at, status: status as Status })
    byTask.set(a.task_id, list)
  }
  for (const list of byTask.values()) list.sort((x, y) => x.at.localeCompare(y.at))
  return byTask
}

/** Status of a task at the end of `day`, or null if it didn't exist yet. */
function statusAt(timeline: StatusEvent[] | undefined, dayEnd: Date): Status | null {
  if (!timeline?.length) return null
  let current: Status | null = null
  for (const e of timeline) {
    if (parseISO(e.at) > dayEnd) break
    current = e.status
  }
  return current
}

function days(from: Date, to: Date) {
  const out: Date[] = []
  const n = Math.max(0, differenceInCalendarDays(to, from))
  for (let i = 0; i <= n; i++) out.push(addDays(startOfDay(from), i))
  return out
}

const endOfDay = (d: Date) => addDays(startOfDay(d), 1)
const label = (d: Date) => format(d, "MMM d")

type ChartTask = Pick<TaskRow, "id" | "story_points" | "status" | "created_at" | "completed_at" | "started_at"> & {
  sprint_id: string | null
}

/** Weight of a task in point-based charts; unestimated tasks count as one point so they still show up. */
const weight = (t: Pick<TaskRow, "story_points">) => t.story_points ?? 1

/**
 * Sprint burndown: remaining points at the end of each sprint day, against the ideal straight line.
 * Uses the tasks currently in the sprint (the usual simplification: scope added mid-sprint counts from day one).
 */
export function burndown(
  sprint: Sprint,
  tasks: ChartTask[],
  timelines: Map<string, StatusEvent[]>,
  today = new Date()
) {
  if (!sprint.start_date || !sprint.end_date) return []
  const start = parseISO(sprint.start_date)
  const end = parseISO(sprint.end_date)
  const scope = tasks.filter((t) => t.sprint_id === sprint.id)
  const total = scope.reduce((s, t) => s + weight(t), 0)
  const span = Math.max(1, differenceInCalendarDays(end, start))
  return days(start, end).map((day, i) => {
    const future = day > startOfDay(today)
    const remaining = scope.reduce((s, t) => {
      const st = statusAt(timelines.get(t.id), endOfDay(day)) ?? (t.status as Status)
      return st === "done" ? s : s + weight(t)
    }, 0)
    return {
      day: label(day),
      ideal: Math.round(total * (1 - i / span) * 10) / 10,
      remaining: future ? null : remaining,
    }
  })
}

/** Velocity: committed vs completed points for recent sprints (active sprint shows progress so far). */
export function velocity(sprints: Sprint[], tasks: ChartTask[]) {
  return sprints
    .filter((s) => s.status !== "planned")
    .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))
    .slice(-8)
    .map((s) => {
      const inSprint = tasks.filter((t) => t.sprint_id === s.id)
      return {
        sprint: s.name,
        committed: s.committed_points ?? inSprint.reduce((n, t) => n + weight(t), 0),
        completed:
          s.status === "completed"
            ? (s.completed_points ?? 0)
            : inSprint.filter((t) => t.status === "done").reduce((n, t) => n + weight(t), 0),
        active: s.status === "active",
      }
    })
}

/** Cumulative flow: task counts in each status at the end of each day. */
export function cumulativeFlow(tasks: ChartTask[], timelines: Map<string, StatusEvent[]>, from: Date, to = new Date()) {
  return days(from, to).map((day) => {
    const counts: Record<Status, number> = { todo: 0, in_progress: 0, review: 0, done: 0 }
    for (const t of tasks) {
      const st = statusAt(timelines.get(t.id), endOfDay(day))
      if (st) counts[st]++
    }
    return { day: label(day), ...counts }
  })
}

/** Burnup: total scope and completed points over time. */
export function burnup(tasks: ChartTask[], timelines: Map<string, StatusEvent[]>, from: Date, to = new Date()) {
  return days(from, to).map((day) => {
    let scope = 0
    let done = 0
    for (const t of tasks) {
      const st = statusAt(timelines.get(t.id), endOfDay(day))
      if (!st) continue
      scope += weight(t)
      if (st === "done") done += weight(t)
    }
    return { day: label(day), scope, done }
  })
}

/** Cycle time (start → done) and lead time (created → done), in days, for finished tasks. */
export function flowTimes(tasks: ChartTask[]) {
  const done = tasks.filter((t) => t.status === "done" && t.completed_at)
  const cycle = done
    .filter((t) => t.started_at)
    .map((t) => Math.max(0, differenceInCalendarDays(parseISO(t.completed_at!), parseISO(t.started_at!))))
  const lead = done.map((t) => Math.max(0, differenceInCalendarDays(parseISO(t.completed_at!), parseISO(t.created_at))))
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
  const buckets = [
    { range: "Same day", min: 0, max: 0 },
    { range: "1–2 days", min: 1, max: 2 },
    { range: "3–5 days", min: 3, max: 5 },
    { range: "6–10 days", min: 6, max: 10 },
    { range: "11+ days", min: 11, max: Infinity },
  ].map((b) => ({ range: b.range, tasks: cycle.filter((d) => d >= b.min && d <= b.max).length }))
  return { cycleAvg: avg(cycle), leadAvg: avg(lead), finished: done.length, buckets }
}

/** Open points per person (a task shared by two people counts for both). */
export function workload(tasks: (ChartTask & { assignees: { profile_id: string }[] })[], people: Person[]) {
  const open = tasks.filter((t) => t.status !== "done")
  const rows = people.map((p) => {
    const mine = open.filter((t) => t.assignees.some((a) => a.profile_id === p.id))
    return {
      person: p.full_name?.split(" ")[0] ?? p.email,
      todo: mine.filter((t) => t.status === "todo").reduce((n, t) => n + weight(t), 0),
      doing: mine.filter((t) => t.status !== "todo").reduce((n, t) => n + weight(t), 0),
    }
  })
  const unassigned = open.filter((t) => !t.assignees.length)
  if (unassigned.length)
    rows.push({
      person: "Unassigned",
      todo: unassigned.filter((t) => t.status === "todo").reduce((n, t) => n + weight(t), 0),
      doing: unassigned.filter((t) => t.status !== "todo").reduce((n, t) => n + weight(t), 0),
    })
  return rows.filter((r) => r.todo + r.doing > 0)
}
