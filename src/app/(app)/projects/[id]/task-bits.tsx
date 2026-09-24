"use client"

import {
  BookOpenIcon,
  BugIcon,
  CalendarIcon,
  CheckSquareIcon,
  FlaskConicalIcon,
  ListChecksIcon,
  PackageIcon,
  PlusIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { AvatarStack } from "@/components/people"
import { SimpleSelect } from "@/components/simple-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { PRIORITY_VARIANT, taskCode, type Person, type Sprint } from "@/lib/agile"
import { formatDate, labelize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { completeSprint, createTask, saveSprint } from "../actions"
import type { ProjectTask } from "./project-view"

export const KIND_ICON: Record<string, LucideIcon> = {
  story: BookOpenIcon,
  task: CheckSquareIcon,
  bug: BugIcon,
  spike: FlaskConicalIcon,
  chore: WrenchIcon,
  deliverable: PackageIcon,
}

export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const Icon = KIND_ICON[kind] ?? CheckSquareIcon
  return <Icon aria-label={labelize(kind)} className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />
}

export function Points({ value }: { value: number | null }) {
  return (
    <span
      title="Story points"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums",
        value === null && "text-muted-foreground"
      )}
    >
      {value ?? "–"}
    </span>
  )
}

export const assigneesOf = (task: ProjectTask, people: Person[]) =>
  people.filter((p) => task.assignees.some((a) => a.profile_id === p.id))

/** Board card. The whole card links to the task page; dragging moves it between columns. */
export function TaskCard({
  task,
  projectKey,
  projectId,
  people,
  draggable,
}: {
  task: ProjectTask
  projectKey: string
  projectId: string
  people: Person[]
  draggable: boolean
}) {
  const subtasks = task.subtasks.length
  const subDone = task.subtasks.filter((s) => s.done).length
  const overdue = task.due_date && task.status !== "done" && task.due_date < new Date().toISOString().slice(0, 10)
  return (
    <Link
      href={`/projects/${projectId}/tasks/${task.id}`}
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/task", task.id)}
      className="group flex flex-col gap-2 rounded-lg border bg-card p-3 text-sm shadow-xs transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <KindIcon kind={task.kind} />
        <span className="font-mono">{taskCode(projectKey, task.number)}</span>
        <span className="ml-auto">
          <Points value={task.story_points} />
        </span>
      </span>
      <span className={cn("font-medium text-pretty", task.status === "done" && "text-muted-foreground line-through")}>
        {task.title}
      </span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={PRIORITY_VARIANT[task.priority as keyof typeof PRIORITY_VARIANT] ?? "outline"}>
          {labelize(task.priority)}
        </Badge>
        {subtasks > 0 && (
          <span className="flex items-center gap-1 tabular-nums">
            <ListChecksIcon className="size-3.5" />
            {subDone}/{subtasks}
          </span>
        )}
        {task.due_date && (
          <span className={cn("flex items-center gap-1", overdue && "text-destructive")}>
            <CalendarIcon className="size-3.5" />
            {formatDate(task.due_date, "MMM d")}
          </span>
        )}
        <span className="ml-auto">
          <AvatarStack people={assigneesOf(task, people)} />
        </span>
      </span>
    </Link>
  )
}

/** Inline "add a task" row: type a title, press Enter. */
export function QuickAdd({
  projectId,
  sprintId,
  status,
  label = "Add task",
}: {
  projectId: string
  sprintId: string | null
  status?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [pending, startTransition] = useTransition()

  if (!open)
    return (
      <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={() => setOpen(true)}>
        <PlusIcon data-icon="inline-start" />
        {label}
      </Button>
    )

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const r = await createTask({ projectId, title, sprintId, status })
          if (!r.ok) toast.error("Couldn't add task", { description: r.error })
          else {
            toast.success("Task added")
            setTitle("")
          }
        })
      }}
    >
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        onBlur={() => !title && setOpen(false)}
        placeholder="What needs doing?"
        aria-label="New task title"
        disabled={pending}
      />
      <Button type="submit" size="sm" disabled={pending || !title.trim()}>
        {pending ? <Spinner /> : "Add"}
      </Button>
    </form>
  )
}

const iso = (d: Date) => d.toLocaleDateString("en-CA")

export function SprintDialog({
  projectId,
  sprint,
  nextNumber,
  open,
  onOpenChange,
}: {
  projectId: string
  sprint: Sprint | null
  nextNumber: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, startTransition] = useTransition()
  const start = new Date()
  const end = new Date()
  end.setDate(end.getDate() + 13)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{sprint ? "Edit sprint" : "New sprint"}</DialogTitle>
          <DialogDescription>Two weeks is a good default. Give it a goal you could demo.</DialogDescription>
        </DialogHeader>
        <form
          key={sprint?.id ?? "new"}
          className="flex flex-col gap-6"
          action={(fd) =>
            startTransition(async () => {
              const get = (k: string) => String(fd.get(k) ?? "")
              const r = await saveSprint(projectId, sprint?.id ?? null, {
                name: get("name"),
                goal: get("goal"),
                start_date: get("start_date"),
                end_date: get("end_date"),
              })
              if (!r.ok) toast.error("Couldn't save sprint", { description: r.error })
              else {
                toast.success(sprint ? "Sprint updated" : "Sprint created")
                onOpenChange(false)
              }
            })
          }
        >
          <FieldGroup className="grid grid-cols-2 gap-4">
            <Field className="col-span-2">
              <FieldLabel htmlFor="sprint-name">Name</FieldLabel>
              <Input id="sprint-name" name="name" required defaultValue={sprint?.name ?? `Sprint ${nextNumber}`} />
            </Field>
            <Field className="col-span-2">
              <FieldLabel htmlFor="sprint-goal">Sprint goal</FieldLabel>
              <Textarea
                id="sprint-goal"
                name="goal"
                rows={2}
                defaultValue={sprint?.goal ?? ""}
                placeholder="e.g. A clinic can book a patient end to end"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="sprint-start">Start</FieldLabel>
              <Input id="sprint-start" name="start_date" type="date" defaultValue={sprint?.start_date ?? iso(start)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="sprint-end">End</FieldLabel>
              <Input id="sprint-end" name="end_date" type="date" defaultValue={sprint?.end_date ?? iso(end)} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {sprint ? "Save sprint" : "Create sprint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CompleteSprintDialog({
  projectId,
  sprint,
  sprints,
  tasks,
  open,
  onOpenChange,
}: {
  projectId: string
  sprint: Sprint
  sprints: Sprint[]
  tasks: ProjectTask[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, startTransition] = useTransition()
  const inSprint = tasks.filter((t) => t.sprint_id === sprint.id && !t.archived_at)
  const unfinished = inSprint.filter((t) => t.status !== "done")
  const planned = sprints.filter((s) => s.status === "planned")
  const [moveTo, setMoveTo] = useState<string>("backlog")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete {sprint.name}</DialogTitle>
          <DialogDescription>
            {inSprint.length - unfinished.length} of {inSprint.length} tasks are done. Completed points are recorded for
            the velocity chart.
          </DialogDescription>
        </DialogHeader>
        {unfinished.length > 0 && (
          <Field>
            <FieldLabel htmlFor="move-to">Move {unfinished.length} unfinished tasks to</FieldLabel>
            <SimpleSelect
              id="move-to"
              value={moveTo}
              onValueChange={(v) => setMoveTo(v || "backlog")}
              options={[
                { value: "backlog", label: "Backlog" },
                ...planned.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <FieldDescription>Carry-over is normal; talk about why in the retro.</FieldDescription>
          </Field>
        )}
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await completeSprint(projectId, sprint.id, moveTo === "backlog" ? null : moveTo)
                if (!r.ok) toast.error("Couldn't complete sprint", { description: r.error })
                else {
                  toast.success(`${sprint.name} completed`)
                  onOpenChange(false)
                }
              })
            }
          >
            {pending && <Spinner data-icon="inline-start" />}
            Complete sprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
