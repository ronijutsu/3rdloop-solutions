"use client"

import type { JSONContent } from "@tiptap/react"
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  ListChecksIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Attachments } from "@/components/attachments"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { DocEditor } from "@/components/editor/doc-editor"
import { NoteThread } from "@/components/note-thread"
import { AssigneePicker } from "@/components/people"
import { useCan } from "@/components/permissions-provider"
import { SimpleSelect } from "@/components/simple-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  FREQUENCIES,
  KINDS,
  POINTS,
  PRIORITIES,
  PRIORITY_VARIANT,
  STATUSES,
  STATUS_LABEL,
  STATUS_VARIANT,
  TEAMS,
  taskCode,
  type Person,
  type Status,
} from "@/lib/agile"
import { formatDate, fromNow, labelize } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

import {
  archiveTask,
  deleteAttachment,
  deleteNote,
  deleteTask,
  postNote,
  recordAttachment,
  saveTaskBody,
  setTaskAssignees,
  updateTask,
} from "../../../actions"
import { KindIcon } from "../../task-bits"
import { ActivityLog, Subtasks, type ActivityEntry, type SubtaskRow } from "./task-sections"

type Tables = Database["public"]["Tables"]
export type TaskDetailData = Tables["tasks"]["Row"] & {
  project: { id: string; name: string; key: string }
  creator: { full_name: string | null; email: string } | null
  assignees: { profile_id: string }[]
  parent: { id: string; number: number; title: string } | null
  subtasks: SubtaskRow[]
  notes: (Tables["task_notes"]["Row"] & { author: Person | null })[]
  attachments: (Tables["task_attachments"]["Row"] & {
    uploader: { full_name: string | null } | null
    url: string | null
  })[]
}

export function TaskDetail({
  me,
  task,
  people,
  sprints,
  activity,
}: {
  me: string
  task: TaskDetailData
  people: Person[]
  sprints: { id: string; name: string; status: string }[]
  activity: ActivityEntry[]
}) {
  const router = useRouter()
  const editable = useCan()("planning.edit")
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const code = taskCode(task.project.key, task.number)
  const done = task.status === "done"
  const archived = Boolean(task.archived_at)
  const canEdit = editable && !archived
  const subDone = task.subtasks.filter((s) => s.status === "done").length

  function commit(patch: Parameters<typeof updateTask>[1], success?: string) {
    startTransition(async () => {
      const r = await updateTask(task.id, patch)
      if (!r.ok) toast.error("Couldn't save", { description: r.error })
      else if (success) toast.success(success)
    })
  }

  function setArchived(value: boolean) {
    startTransition(async () => {
      const r = await archiveTask(task.id, value)
      if (!r.ok) toast.error("Couldn't update", { description: r.error })
      else toast.success(value ? `${code} archived` : `${code} restored`)
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        render={
          <Link
            href={
              task.parent
                ? `/projects/${task.project.id}/tasks/${task.parent.id}`
                : `/projects/${task.project.id}?tab=backlog`
            }
          />
        }
      >
        <ArrowLeftIcon data-icon="inline-start" />
        {task.parent ? `${taskCode(task.project.key, task.parent.number)} ${task.parent.title}` : task.project.name}
      </Button>

      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          {task.parent && (
            <p className="text-xs font-medium text-muted-foreground">
              Sub-task of{" "}
              <Link href={`/projects/${task.project.id}/tasks/${task.parent.id}`} className="hover:underline">
                {taskCode(task.project.key, task.parent.number)} · {task.parent.title}
              </Link>
            </p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{task.title}</h1>
          {task.description && <p className="max-w-3xl text-pretty text-muted-foreground">{task.description}</p>}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="gap-1 font-mono">
              <KindIcon kind={task.kind} className="size-3" />
              {code}
            </Badge>
            <Badge variant={STATUS_VARIANT[task.status as Status] ?? "outline"}>
              {STATUS_LABEL[task.status as Status] ?? task.status}
            </Badge>
            <Badge variant={PRIORITY_VARIANT[task.priority as keyof typeof PRIORITY_VARIANT] ?? "outline"}>
              {labelize(task.priority)} priority
            </Badge>
            {archived && <Badge variant="destructive">Archived</Badge>}
            <span className="flex items-center gap-1 tabular-nums" title="Sub-tasks done">
              <ListChecksIcon className="size-3.5" />
              {subDone}/{task.subtasks.length}
            </span>
            <span className="flex items-center gap-1 tabular-nums" title="Notes">
              <MessageSquareIcon className="size-3.5" />
              {task.notes.length}
            </span>
            <span className="flex items-center gap-1 tabular-nums" title="Attachments">
              <PaperclipIcon className="size-3.5" />
              {task.attachments.length}
            </span>
          </div>
        </div>
        {editable && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {!archived &&
              (done ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => commit({ status: "in_progress" }, "Reopened")}
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  Reopen
                </Button>
              ) : (
                <Button disabled={pending} onClick={() => commit({ status: "done" }, `${code} completed`)}>
                  <CheckCircle2Icon data-icon="inline-start" />
                  Mark completed
                </Button>
              ))}
            {canEdit && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <PencilIcon data-icon="inline-start" />
                Edit
              </Button>
            )}
            <Button variant="outline" disabled={pending} onClick={() => setArchived(!archived)}>
              {archived ? <ArchiveRestoreIcon data-icon="inline-start" /> : <ArchiveIcon data-icon="inline-start" />}
              {archived ? "Restore" : "Archive"}
            </Button>
          </div>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-2" aria-labelledby="body-heading">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="body-heading" className="font-medium">
                Body
              </h2>
              <span className="text-xs text-muted-foreground">Every change is recorded in the activity log</span>
            </div>
            <DocEditor
              compact
              exportable
              editable={canEdit}
              title={`${code} ${task.title}`}
              aiEnabled={false}
              placeholder="Describe the work: context, acceptance criteria, links…"
              initialContent={(task.body as JSONContent | null) ?? ""}
              onSave={({ json }) => saveTaskBody(task.id, json)}
            />
          </section>

          <Subtasks
            taskId={task.id}
            projectId={task.project.id}
            projectKey={task.project.key}
            subtasks={task.subtasks}
            people={people}
            editable={canEdit}
          />
          <Attachments
            prefix={`${task.project.id}/${task.id}`}
            attachments={task.attachments}
            editable={canEdit}
            description="Stored privately in this project's files. Drop files here to attach."
            onRecord={(file) => recordAttachment(task.id, file)}
            onRemove={deleteAttachment}
          />
          <NoteThread
            me={me}
            notes={task.notes}
            editable={canEdit}
            description="Updates, decisions, and questions about this task."
            deleteHint="The activity log keeps a record that a note was deleted."
            onPost={(json, html) => postNote(task.id, json, html)}
            onDelete={deleteNote}
          />
        </div>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Properties</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <Prop label="Assigned to">
                <AssigneePicker
                  people={people}
                  value={task.assignees.map((a) => a.profile_id)}
                  disabled={!canEdit}
                  onChange={(ids) =>
                    startTransition(async () => {
                      const r = await setTaskAssignees(task.id, ids)
                      if (!r.ok) toast.error("Couldn't update assignees", { description: r.error })
                    })
                  }
                />
              </Prop>
              <Prop label="Status">
                <SimpleSelect
                  size="sm"
                  value={task.status}
                  disabled={!canEdit}
                  options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
                  onValueChange={(v) => commit({ status: v })}
                />
              </Prop>
              <div className="grid grid-cols-2 gap-3">
                <Prop label="Kind">
                  <SimpleSelect
                    size="sm"
                    value={task.kind}
                    disabled={!canEdit}
                    options={KINDS.map((k) => ({ value: k, label: labelize(k) }))}
                    onValueChange={(v) => commit({ kind: v })}
                  />
                </Prop>
                <Prop label="Priority">
                  <SimpleSelect
                    size="sm"
                    value={task.priority}
                    disabled={!canEdit}
                    options={PRIORITIES.map((p) => ({ value: p, label: labelize(p) }))}
                    onValueChange={(v) => commit({ priority: v })}
                  />
                </Prop>
                <Prop label="Sprint">
                  <SimpleSelect
                    size="sm"
                    value={task.sprint_id ?? "backlog"}
                    disabled={!canEdit}
                    options={[
                      { value: "backlog", label: "Backlog" },
                      ...sprints.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                    onValueChange={(v) => commit({ sprint_id: v === "backlog" ? null : v })}
                  />
                </Prop>
                <Prop label="Story points">
                  <SimpleSelect
                    size="sm"
                    value={task.story_points === null ? "none" : String(task.story_points)}
                    disabled={!canEdit}
                    options={[
                      { value: "none", label: "Not estimated" },
                      ...POINTS.map((p) => ({ value: String(p), label: String(p) })),
                    ]}
                    onValueChange={(v) => commit({ story_points: v === "none" ? null : Number(v) })}
                  />
                </Prop>
              </div>
              <Prop label="Teams">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Teams">
                  {TEAMS.map((team) => {
                    const on = task.teams.includes(team)
                    return (
                      <button
                        key={team}
                        type="button"
                        disabled={!canEdit}
                        aria-pressed={on}
                        onClick={() =>
                          commit({ teams: on ? task.teams.filter((t) => t !== team) : [...task.teams, team] })
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs transition-colors enabled:hover:bg-muted disabled:cursor-default",
                          on ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground",
                          !canEdit && !on && "hidden"
                        )}
                      >
                        {team}
                      </button>
                    )
                  })}
                  {!canEdit && !task.teams.length && <span className="text-muted-foreground">None</span>}
                </div>
              </Prop>
              <div className="grid grid-cols-2 gap-3">
                <Prop label="Start date">
                  <Input
                    type="date"
                    className="h-8"
                    defaultValue={task.start_date ?? ""}
                    disabled={!canEdit}
                    onBlur={(e) => e.target.value !== (task.start_date ?? "") && commit({ start_date: e.target.value })}
                  />
                </Prop>
                <Prop label="Due date">
                  <Input
                    type="date"
                    className="h-8"
                    defaultValue={task.due_date ?? ""}
                    disabled={!canEdit}
                    onBlur={(e) => e.target.value !== (task.due_date ?? "") && commit({ due_date: e.target.value })}
                  />
                </Prop>
                <Prop label="Frequency">
                  <SimpleSelect
                    size="sm"
                    value={task.frequency}
                    disabled={!canEdit}
                    options={FREQUENCIES.map((f) => ({ value: f, label: f === "once" ? "One-off" : labelize(f) }))}
                    onValueChange={(v) => commit({ frequency: v })}
                  />
                </Prop>
                <Prop label="Reporting period">
                  <Input
                    className="h-8"
                    placeholder="e.g. Q4 2026"
                    defaultValue={task.reporting_period ?? ""}
                    disabled={!canEdit}
                    onBlur={(e) =>
                      e.target.value.trim() !== (task.reporting_period ?? "") &&
                      commit({ reporting_period: e.target.value.trim() })
                    }
                  />
                </Prop>
              </div>
              <Prop label="Progress">
                <div className="flex items-center gap-3">
                  <Progress value={task.progress} className="flex-1" aria-label="Progress" />
                  <span className="w-10 text-right text-xs tabular-nums">{task.progress}%</span>
                </div>
                {canEdit && !task.subtasks.length && !done && (
                  <div className="flex gap-1">
                    {[0, 25, 50, 75].map((p) => (
                      <Button
                        key={p}
                        variant={task.progress === p ? "secondary" : "ghost"}
                        size="xs"
                        onClick={() => commit({ progress: p })}
                      >
                        {p}%
                      </Button>
                    ))}
                  </div>
                )}
                {task.subtasks.length > 0 && (
                  <p className="text-xs text-muted-foreground">Follows how many sub-tasks are done.</p>
                )}
              </Prop>
              <Separator />
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-right">
                  {formatDate(task.created_at)}
                  {task.creator && ` by ${task.creator.full_name ?? task.creator.email}`}
                </dd>
                <dt className="text-muted-foreground">Last update</dt>
                <dd className="text-right" suppressHydrationWarning>
                  {fromNow(task.updated_at)}
                </dd>
                {task.completed_at && (
                  <>
                    <dt className="text-muted-foreground">Completed</dt>
                    <dd className="text-right">{formatDate(task.completed_at)}</dd>
                  </>
                )}
              </dl>
            </CardContent>
          </Card>

          <ActivityLog entries={activity} sprints={sprints} />

          {editable && (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle>Danger zone</CardTitle>
                <CardDescription>
                  Archiving hides the task from the board and backlog but keeps its history. Deleting removes it, its
                  notes, attachments, and activity for good.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={pending} onClick={() => setArchived(!archived)}>
                  {archived ? (
                    <ArchiveRestoreIcon data-icon="inline-start" />
                  ) : (
                    <ArchiveIcon data-icon="inline-start" />
                  )}
                  {archived ? "Restore" : "Archive"}
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="destructive">
                      <Trash2Icon data-icon="inline-start" />
                      Delete permanently
                    </Button>
                  }
                  title={`Delete ${code} permanently?`}
                  description="This removes the task, its sub-tasks, notes, attachments, and activity log. It can't be undone."
                  confirmLabel="Delete permanently"
                  onConfirm={async () => {
                    const r = await deleteTask(task.id)
                    if (!r.ok) toast.error("Couldn't delete", { description: r.error })
                    else {
                      toast.success(`${code} deleted`)
                      router.push(`/projects/${task.project.id}?tab=backlog`)
                    }
                  }}
                />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      <EditDialog task={task} open={editing} onOpenChange={setEditing} />
    </>
  )
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function EditDialog({
  task,
  open,
  onOpenChange,
}: {
  task: TaskDetailData
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, startTransition] = useTransition()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>The title and one-line summary shown on the board.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          action={(fd) =>
            startTransition(async () => {
              const r = await updateTask(task.id, {
                title: String(fd.get("title") ?? ""),
                description: String(fd.get("description") ?? "").trim(),
              })
              if (!r.ok) toast.error("Couldn't save", { description: r.error })
              else {
                toast.success("Task updated")
                onOpenChange(false)
              }
            })
          }
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="task-title">Title</FieldLabel>
              <Input id="task-title" name="title" required defaultValue={task.title} />
            </Field>
            <Field>
              <FieldLabel htmlFor="task-summary">Summary</FieldLabel>
              <Textarea id="task-summary" name="description" rows={2} defaultValue={task.description ?? ""} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
