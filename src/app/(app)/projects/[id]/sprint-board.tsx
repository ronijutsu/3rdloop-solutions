"use client"

import { differenceInCalendarDays, parseISO } from "date-fns"
import { FlagIcon, KanbanIcon } from "lucide-react"
import Link from "next/link"
import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"

import { PersonAvatar } from "@/components/people"
import { useCan } from "@/components/permissions-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { STATUSES, STATUS_LABEL, type Person, type Sprint } from "@/lib/agile"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

import { updateTask } from "../actions"
import type { Project, ProjectTask } from "./project-view"
import { CompleteSprintDialog, QuickAdd, TaskCard } from "./task-bits"

const weight = (t: ProjectTask) => t.story_points ?? 0

export function SprintBoard({
  project,
  sprint,
  sprints,
  tasks,
  people,
}: {
  project: Project
  sprint: Sprint | null
  sprints: Sprint[]
  tasks: ProjectTask[]
  people: Person[]
}) {
  const editable = useCan()("planning.edit")
  const [, startTransition] = useTransition()
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [filter, setFilter] = useState<string[]>([])
  const [completing, setCompleting] = useState(false)

  // With a running sprint the board shows its tasks; otherwise it works as a plain Kanban over unplanned work.
  const planned = new Set(sprints.filter((s) => s.status === "planned").map((s) => s.id))
  const scope = sprint
    ? tasks.filter((t) => t.sprint_id === sprint.id)
    : tasks.filter((t) => !t.sprint_id || !planned.has(t.sprint_id))
  const [optimistic, move] = useOptimistic(scope, (state, m: { id: string; status: string }) =>
    state.map((t) => (t.id === m.id ? { ...t, status: m.status } : t))
  )
  const visible = filter.length
    ? optimistic.filter((t) =>
        filter.some((f) => (f === "none" ? !t.assignees.length : t.assignees.some((a) => a.profile_id === f)))
      )
    : optimistic
  const involved = people.filter((p) => scope.some((t) => t.assignees.some((a) => a.profile_id === p.id)))

  function drop(status: string, id: string) {
    setDragOver(null)
    if (!editable || !id || optimistic.find((t) => t.id === id)?.status === status) return
    startTransition(async () => {
      move({ id, status })
      const r = await updateTask(id, { status })
      if (!r.ok) toast.error("Couldn't move task", { description: r.error })
      else if (status === "done") toast.success("Nice — task done")
    })
  }

  const total = scope.reduce((n, t) => n + weight(t), 0)
  const done = scope.filter((t) => t.status === "done").reduce((n, t) => n + weight(t), 0)
  const daysLeft = sprint?.end_date ? differenceInCalendarDays(parseISO(sprint.end_date), new Date()) : null

  return (
    <>
      {sprint ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center md:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{sprint.name}</h2>
              <Badge variant="secondary">Active</Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(sprint.start_date, "MMM d")} – {formatDate(sprint.end_date, "MMM d")}
                {daysLeft !== null &&
                  ` · ${daysLeft < 0 ? `${-daysLeft} days over` : daysLeft === 0 ? "ends today" : `${daysLeft} days left`}`}
              </span>
            </div>
            {sprint.goal && (
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <FlagIcon className="mt-0.5 size-3.5 shrink-0" />
                {sprint.goal}
              </p>
            )}
          </div>
          <div className="flex min-w-48 flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Points done</span>
              <span className="font-medium tabular-nums">
                {done}/{total}
              </span>
            </div>
            <Progress value={total ? (done / total) * 100 : 0} aria-label="Sprint progress" />
          </div>
          {editable && (
            <Button variant="outline" size="sm" onClick={() => setCompleting(true)}>
              Complete sprint
            </Button>
          )}
        </div>
      ) : (
        <Empty className="border py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KanbanIcon />
            </EmptyMedia>
            <EmptyTitle>No sprint running</EmptyTitle>
            <EmptyDescription>
              The board shows all unplanned work as a Kanban. Plan a sprint in the backlog to time-box it and get a
              burndown.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" render={<Link href="?tab=backlog" />}>
              Plan a sprint
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {involved.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by assignee">
          <span className="text-xs text-muted-foreground">Filter</span>
          {[...involved, { id: "none", full_name: "Unassigned", email: "" }].map((p) => {
            const on = filter.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter((f) => (on ? f.filter((x) => x !== p.id) : [...f, p.id]))}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs transition-colors hover:bg-muted",
                  on && "border-primary bg-primary/10"
                )}
              >
                {p.id === "none" ? <span className="size-6" /> : <PersonAvatar person={p} />}
                {p.full_name?.split(" ")[0] ?? p.email}
              </button>
            )
          })}
          {filter.length > 0 && (
            <Button variant="ghost" size="xs" onClick={() => setFilter([])}>
              Clear
            </Button>
          )}
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 md:-mx-8 md:px-8">
        <div className="grid min-w-[56rem] grid-cols-4 gap-3">
          {STATUSES.map((status) => {
            const column = visible.filter((t) => t.status === status)
            const points = column.reduce((n, t) => n + weight(t), 0)
            return (
              <section
                key={status}
                aria-label={STATUS_LABEL[status]}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(status)
                }}
                onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
                onDrop={(e) => drop(status, e.dataTransfer.getData("text/task"))}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border bg-muted/40 p-2 transition-colors",
                  dragOver === status && "border-primary bg-primary/5"
                )}
              >
                <header className="flex items-center gap-2 px-1 py-1">
                  <span className="text-sm font-medium">{STATUS_LABEL[status]}</span>
                  <Badge variant="secondary">{column.length}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{points} pts</span>
                </header>
                <div className="flex min-h-24 flex-col gap-2">
                  {column.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      projectKey={project.key}
                      projectId={project.id}
                      people={people}
                      draggable={editable}
                    />
                  ))}
                </div>
                {editable && status === "todo" && (
                  <QuickAdd projectId={project.id} sprintId={sprint?.id ?? null} status="todo" />
                )}
              </section>
            )
          })}
        </div>
      </div>

      {sprint && (
        <CompleteSprintDialog
          projectId={project.id}
          sprint={sprint}
          sprints={sprints}
          tasks={tasks}
          open={completing}
          onOpenChange={setCompleting}
        />
      )}
    </>
  )
}
