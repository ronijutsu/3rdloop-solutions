"use client"

import {
  ArchiveRestoreIcon,
  ChevronDownIcon,
  FlagIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import Link from "next/link"
import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { AvatarStack } from "@/components/people"
import { useCan } from "@/components/permissions-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { POINTS, STATUS_LABEL, STATUS_VARIANT, taskCode, type Person, type Sprint, type Status } from "@/lib/agile"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

import { archiveTask, deleteSprint, startSprint, updateTask } from "../actions"
import type { Project, ProjectTask } from "./project-view"
import { assigneesOf, CompleteSprintDialog, KindIcon, QuickAdd, SprintDialog } from "./task-bits"

const BACKLOG = "backlog"
const sumPoints = (tasks: ProjectTask[]) => tasks.reduce((n, t) => n + (t.story_points ?? 0), 0)

export function Backlog({
  project,
  sprints,
  tasks,
  people,
}: {
  project: Project
  sprints: Sprint[]
  tasks: ProjectTask[]
  people: Person[]
}) {
  const editable = useCan()("planning.edit")
  const [, startTransition] = useTransition()
  const [optimistic, patch] = useOptimistic(
    tasks,
    (state, p: { id: string; sprint_id?: string | null; story_points?: number | null }) =>
      state.map((t) => (t.id === p.id ? { ...t, ...p } : t))
  )
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [editingSprint, setEditingSprint] = useState<Sprint | null | "new">(null)
  const [completing, setCompleting] = useState<Sprint | null>(null)
  const [deleting, setDeleting] = useState<Sprint | null>(null)

  const live = optimistic.filter((t) => !t.archived_at)
  const archived = optimistic.filter((t) => t.archived_at)
  const open = sprints
    .filter((s) => s.status !== "completed")
    .sort((a, b) => (a.status === "active" ? -1 : b.status === "active" ? 1 : 0))
  const completed = sprints.filter((s) => s.status === "completed").reverse()
  const hasActive = sprints.some((s) => s.status === "active")
  const backlog = live.filter((t) => !t.sprint_id)

  function moveTo(task: ProjectTask, sprintId: string | null) {
    if (task.sprint_id === sprintId) return
    startTransition(async () => {
      patch({ id: task.id, sprint_id: sprintId })
      const r = await updateTask(task.id, { sprint_id: sprintId })
      if (!r.ok) toast.error("Couldn't move task", { description: r.error })
    })
  }

  function drop(target: string, id: string) {
    setDragOver(null)
    const task = live.find((t) => t.id === id)
    if (editable && task) moveTo(task, target === BACKLOG ? null : target)
  }

  function setPoints(task: ProjectTask, points: number | null) {
    startTransition(async () => {
      patch({ id: task.id, story_points: points })
      const r = await updateTask(task.id, { story_points: points })
      if (!r.ok) toast.error("Couldn't set points", { description: r.error })
    })
  }

  const row = (task: ProjectTask) => (
    <TaskRow
      key={task.id}
      task={task}
      project={project}
      people={people}
      sprints={open}
      editable={editable}
      onMove={(s) => moveTo(task, s)}
      onPoints={(p) => setPoints(task, p)}
    />
  )

  const dropZone = (id: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!editable) return
      e.preventDefault()
      setDragOver(id)
    },
    onDragLeave: () => setDragOver((s) => (s === id ? null : s)),
    onDrop: (e: React.DragEvent) => drop(id, e.dataTransfer.getData("text/task")),
    className: cn(
      "flex flex-col rounded-xl border bg-card transition-colors",
      dragOver === id && "border-primary bg-primary/5"
    ),
  })

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Drag tasks between sprints and the backlog, or use each row&apos;s menu. Estimate in story points.
        </p>
        {editable && (
          <Button size="sm" onClick={() => setEditingSprint("new")}>
            <PlusIcon data-icon="inline-start" />
            New sprint
          </Button>
        )}
      </div>

      {open.map((sprint) => {
        const items = live.filter((t) => t.sprint_id === sprint.id)
        return (
          <section key={sprint.id} aria-label={sprint.name} {...dropZone(sprint.id)}>
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
              <h2 className="font-semibold">{sprint.name}</h2>
              <Badge variant={sprint.status === "active" ? "default" : "outline"}>
                {sprint.status === "active" ? "Active" : "Planned"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {sprint.start_date
                  ? `${formatDate(sprint.start_date, "MMM d")} – ${formatDate(sprint.end_date, "MMM d")}`
                  : "No dates"}
                {` · ${items.length} tasks · ${sumPoints(items)} pts`}
              </span>
              {editable && (
                <div className="ml-auto flex items-center gap-1">
                  {sprint.status === "planned" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={hasActive || !items.length}
                      title={
                        hasActive ? "Complete the active sprint first" : !items.length ? "Add tasks first" : undefined
                      }
                      onClick={() =>
                        startTransition(async () => {
                          const r = await startSprint(project.id, sprint.id)
                          if (!r.ok) toast.error("Couldn't start sprint", { description: r.error })
                          else toast.success(`${sprint.name} started`)
                        })
                      }
                    >
                      <PlayIcon data-icon="inline-start" />
                      Start sprint
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setCompleting(sprint)}>
                      Complete sprint
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Sprint actions" />}>
                      <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => setEditingSprint(sprint)}>
                          <PencilIcon />
                          Edit sprint
                        </DropdownMenuItem>
                        {sprint.status === "planned" && (
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(sprint)}>
                            <Trash2Icon />
                            Delete sprint
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              {sprint.goal && (
                <p className="flex w-full items-start gap-1.5 text-sm text-muted-foreground">
                  <FlagIcon className="mt-0.5 size-3.5 shrink-0" />
                  {sprint.goal}
                </p>
              )}
            </header>
            <ul className="flex flex-col divide-y">{items.map(row)}</ul>
            {!items.length && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Drag tasks here from the backlog to plan this sprint.
              </p>
            )}
            {editable && (
              <div className="border-t p-2">
                <QuickAdd projectId={project.id} sprintId={sprint.id} />
              </div>
            )}
          </section>
        )
      })}

      <section aria-label="Backlog" {...dropZone(BACKLOG)}>
        <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <h2 className="font-semibold">Backlog</h2>
          <span className="text-xs text-muted-foreground">
            {backlog.length} tasks · {sumPoints(backlog)} pts
          </span>
        </header>
        <ul className="flex flex-col divide-y">{backlog.map(row)}</ul>
        {!backlog.length && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            The backlog is empty. Add what&apos;s next.
          </p>
        )}
        {editable && (
          <div className="border-t p-2">
            <QuickAdd projectId={project.id} sprintId={null} label="Add to backlog" />
          </div>
        )}
      </section>

      {completed.length > 0 && (
        <Collapsible className="flex flex-col gap-2">
          <CollapsibleTrigger render={<Button variant="ghost" size="sm" className="self-start" />}>
            <ChevronDownIcon
              data-icon="inline-start"
              className="transition-transform in-data-[panel-open]:rotate-180"
            />
            Completed sprints ({completed.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {completed.map((s) => {
                const items = live.filter((t) => t.sprint_id === s.id)
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(s.start_date, "MMM d")} – {formatDate(s.end_date, "MMM d")}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {s.completed_points ?? 0} of {s.committed_points ?? 0} pts · {items.length} tasks done
                    </span>
                  </li>
                )
              })}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      {archived.length > 0 && (
        <Collapsible className="flex flex-col gap-2">
          <CollapsibleTrigger render={<Button variant="ghost" size="sm" className="self-start" />}>
            <ChevronDownIcon
              data-icon="inline-start"
              className="transition-transform in-data-[panel-open]:rotate-180"
            />
            Archived tasks ({archived.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {archived.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{taskCode(project.key, t.number)}</span>
                  <Link href={`/projects/${project.id}/tasks/${t.id}`} className="truncate hover:underline">
                    {t.title}
                  </Link>
                  {editable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() =>
                        startTransition(async () => {
                          const r = await archiveTask(t.id, false)
                          if (!r.ok) toast.error("Couldn't restore", { description: r.error })
                          else toast.success("Task restored")
                        })
                      }
                    >
                      <ArchiveRestoreIcon data-icon="inline-start" />
                      Restore
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      <SprintDialog
        projectId={project.id}
        sprint={editingSprint === "new" ? null : editingSprint}
        nextNumber={sprints.length + 1}
        open={editingSprint !== null}
        onOpenChange={(o) => !o && setEditingSprint(null)}
      />
      {completing && (
        <CompleteSprintDialog
          projectId={project.id}
          sprint={completing}
          sprints={sprints}
          tasks={tasks}
          open
          onOpenChange={(o) => !o && setCompleting(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Its tasks move back to the backlog."
        confirmLabel="Delete sprint"
        onConfirm={async () => {
          if (!deleting) return
          const r = await deleteSprint(project.id, deleting.id)
          if (!r.ok) toast.error("Couldn't delete sprint", { description: r.error })
          else toast.success("Sprint deleted")
        }}
      />
    </>
  )
}

function TaskRow({
  task,
  project,
  people,
  sprints,
  editable,
  onMove,
  onPoints,
}: {
  task: ProjectTask
  project: Project
  people: Person[]
  sprints: Sprint[]
  editable: boolean
  onMove: (sprintId: string | null) => void
  onPoints: (points: number | null) => void
}) {
  return (
    <li
      draggable={editable}
      onDragStart={(e) => e.dataTransfer.setData("text/task", task.id)}
      className={cn("flex items-center gap-3 px-4 py-2 text-sm", editable && "cursor-grab active:cursor-grabbing")}
    >
      <KindIcon kind={task.kind} />
      <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
        {taskCode(project.key, task.number)}
      </span>
      <Link
        href={`/projects/${project.id}/tasks/${task.id}`}
        className={cn(
          "min-w-0 flex-1 truncate hover:underline",
          task.status === "done" && "text-muted-foreground line-through"
        )}
      >
        {task.title}
      </Link>
      <span className="hidden sm:inline-flex">
        <AvatarStack people={assigneesOf(task, people)} />
      </span>
      <Badge variant={STATUS_VARIANT[task.status as Status] ?? "outline"} className="hidden md:inline-flex">
        {STATUS_LABEL[task.status as Status] ?? task.status}
      </Badge>
      {editable ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                className="min-w-8 tabular-nums"
                aria-label={`Story points: ${task.story_points ?? "none"}`}
              />
            }
          >
            {task.story_points ?? "–"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Story points</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={task.story_points === null ? "none" : String(task.story_points)}
                onValueChange={(v) => onPoints(v === "none" ? null : Number(v))}
              >
                <DropdownMenuRadioItem value="none">Not estimated</DropdownMenuRadioItem>
                {POINTS.map((p) => (
                  <DropdownMenuRadioItem key={p} value={String(p)}>
                    {p}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="w-8 text-center text-xs tabular-nums">{task.story_points ?? "–"}</span>
      )}
      {editable && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Move task" />}>
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {sprints.map((s) => (
                <DropdownMenuItem key={s.id} disabled={task.sprint_id === s.id} onClick={() => onMove(s.id)}>
                  {s.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!task.sprint_id} onClick={() => onMove(null)}>
                Backlog
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}
