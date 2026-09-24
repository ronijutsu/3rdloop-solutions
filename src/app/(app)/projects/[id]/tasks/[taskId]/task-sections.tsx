"use client"

import { HistoryIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"

import { AvatarStack } from "@/components/people"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { STATUS_LABEL, STATUS_VARIANT, taskCode, type Person, type Status } from "@/lib/agile"
import { formatDate, fromNow, labelize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { createTask, updateTask } from "../../../actions"
import { KindIcon } from "../../task-bits"

// ---------------------------------------------------------------------------
// Sub-tasks
// ---------------------------------------------------------------------------

export type SubtaskRow = {
  id: string
  number: number
  title: string
  status: string
  priority: string
  kind: string
  story_points: number | null
  due_date: string | null
  assignees: { profile_id: string }[]
}

/** Sub-tasks are full tasks: each row opens its own page. The checkbox is a shortcut for done / to do. */
export function Subtasks({
  taskId,
  projectId,
  projectKey,
  subtasks,
  people,
  editable,
}: {
  taskId: string
  projectId: string
  projectKey: string
  subtasks: SubtaskRow[]
  people: Person[]
  editable: boolean
}) {
  const [, startTransition] = useTransition()
  const [items, setStatus] = useOptimistic(subtasks, (state, m: { id: string; status: string }) =>
    state.map((s) => (s.id === m.id ? { ...s, status: m.status } : s))
  )
  const [title, setTitle] = useState("")
  const [adding, startAdding] = useTransition()
  const done = items.filter((s) => s.status === "done").length
  const today = new Date().toLocaleDateString("en-CA")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sub-tasks</CardTitle>
        <CardDescription className="tabular-nums">
          {items.length
            ? `${done} of ${items.length} done · each one is a full task with its own page`
            : "Split the work into tasks of their own, each with owners, notes, and files."}
        </CardDescription>
        {items.length > 0 && (
          <CardAction className="w-32 self-center">
            <Progress value={(done / items.length) * 100} aria-label="Sub-task progress" />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <ul className="flex flex-col divide-y">
          {items.map((s) => {
            const isDone = s.status === "done"
            const late = !isDone && s.due_date && s.due_date < today
            return (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <Checkbox
                  checked={isDone}
                  disabled={!editable}
                  aria-label={isDone ? `Reopen ${s.title}` : `Complete ${s.title}`}
                  onCheckedChange={(checked) =>
                    startTransition(async () => {
                      const status = checked ? "done" : "todo"
                      setStatus({ id: s.id, status })
                      const r = await updateTask(s.id, { status })
                      if (!r.ok) toast.error("Couldn't update sub-task", { description: r.error })
                    })
                  }
                />
                <KindIcon kind={s.kind} />
                <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                  {taskCode(projectKey, s.number)}
                </span>
                <Link
                  href={`/projects/${projectId}/tasks/${s.id}`}
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm hover:underline",
                    isDone && "text-muted-foreground line-through"
                  )}
                >
                  {s.title}
                </Link>
                {s.due_date && (
                  <span className={cn("hidden text-xs text-muted-foreground sm:inline", late && "text-destructive")}>
                    {formatDate(s.due_date, "MMM d")}
                  </span>
                )}
                <span className="hidden sm:inline-flex">
                  <AvatarStack people={people.filter((p) => s.assignees.some((a) => a.profile_id === p.id))} />
                </span>
                <Badge variant={STATUS_VARIANT[s.status as Status] ?? "outline"} className="hidden md:inline-flex">
                  {STATUS_LABEL[s.status as Status] ?? s.status}
                </Badge>
              </li>
            )
          })}
        </ul>
        {editable && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              startAdding(async () => {
                const r = await createTask({ projectId, parentId: taskId, title })
                if (!r.ok) toast.error("Couldn't add sub-task", { description: r.error })
                else {
                  toast.success("Sub-task added")
                  setTitle("")
                }
              })
            }}
          >
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a sub-task"
              aria-label="New sub-task"
              disabled={adding}
            />
            <Button type="submit" variant="outline" disabled={adding || !title.trim()}>
              <PlusIcon data-icon="inline-start" />
              Add
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export type ActivityEntry = {
  id: number
  action: string
  detail: unknown
  created_at: string
  actor: { full_name: string | null; email: string } | null
}

const FIELD_LABEL: Record<string, string> = {
  title: "title",
  description: "summary",
  status: "status",
  priority: "priority",
  kind: "kind",
  story_points: "story points",
  teams: "teams",
  start_date: "start date",
  due_date: "due date",
  frequency: "frequency",
  reporting_period: "reporting period",
  progress: "progress",
  sprint_id: "sprint",
  archived_at: "archive",
}

function describe(entry: ActivityEntry, sprintName: (id: string) => string) {
  const d = (entry.detail ?? {}) as Record<string, unknown>
  const q = (v: unknown) => `“${String(v)}”`
  const value = (field: string, v: unknown): string => {
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return "none"
    if (field === "status") return STATUS_LABEL[v as Status] ?? String(v)
    if (field === "sprint_id") return sprintName(String(v))
    if (field === "progress") return `${v}%`
    if (field === "start_date" || field === "due_date") return formatDate(String(v))
    if (field === "teams" && Array.isArray(v)) return v.join(", ")
    if (field === "priority" || field === "kind" || field === "frequency") return labelize(String(v))
    return q(v)
  }
  switch (entry.action) {
    case "created":
      return "created the task"
    case "body_edited":
      return "edited the body"
    case "assigned":
      return `assigned ${d.name}`
    case "unassigned":
      return `unassigned ${d.name}`
    case "subtask_added":
      return `added sub-task ${q(d.title)}`
    case "subtask_removed":
      return `removed sub-task ${q(d.title)}`
    case "subtask_done":
      return `completed sub-task ${q(d.title)}`
    case "subtask_reopened":
      return `reopened sub-task ${q(d.title)}`
    case "subtask_renamed":
      return `renamed sub-task ${q(d.from)} to ${q(d.to)}`
    case "note_added":
      return "posted a note"
    case "note_deleted":
      return "deleted a note"
    case "attachment_added":
      return `attached ${q(d.name)}`
    case "attachment_removed":
      return `removed attachment ${q(d.name)}`
    case "changed": {
      const field = String(d.field)
      if (field === "archived_at") return d.to ? "archived the task" : "restored the task"
      if (field === "sprint_id") return d.to ? `moved it to ${sprintName(String(d.to))}` : "moved it to the backlog"
      if (field === "description") return "updated the summary"
      if (field === "title") return `renamed it to ${q(d.to)}`
      const label = FIELD_LABEL[field] ?? field
      return d.from === null || d.from === undefined
        ? `set ${label} to ${value(field, d.to)}`
        : `changed ${label} from ${value(field, d.from)} to ${value(field, d.to)}`
    }
    default:
      return labelize(entry.action).toLowerCase()
  }
}

export function ActivityLog({
  entries,
  sprints,
}: {
  entries: ActivityEntry[]
  sprints: { id: string; name: string }[]
}) {
  const names = new Map(sprints.map((s) => [s.id, s.name]))
  const sprintName = (id: string) => names.get(id) ?? "another sprint"
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HistoryIcon className="size-4 text-muted-foreground" />
          Activity log
        </CardTitle>
        <CardDescription>Append-only. Nobody can edit or remove entries.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-96">
          <ol className="relative flex flex-col gap-3 border-l pl-4">
            {entries.map((e) => (
              <li key={e.id} className="relative text-sm">
                <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full border-2 border-card bg-muted-foreground/60" />
                <span className="font-medium">{e.actor?.full_name ?? e.actor?.email ?? "System"}</span>{" "}
                <span className="text-muted-foreground">{describe(e, sprintName)}</span>
                <time
                  suppressHydrationWarning
                  dateTime={e.created_at}
                  title={formatDate(e.created_at, "PPpp")}
                  className="block text-xs text-muted-foreground"
                >
                  {fromNow(e.created_at)}
                </time>
              </li>
            ))}
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
