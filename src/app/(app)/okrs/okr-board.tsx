"use client"

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useState, useTransition } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { useCan } from "@/components/permissions-provider"
import { SimpleSelect } from "@/components/simple-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { deleteRow, saveRow } from "@/lib/actions/crud"
import { labelize, options } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"
import { useNewParam } from "@/hooks/use-new-param"

type KR = Database["public"]["Tables"]["key_results"]["Row"]
type Objective = Database["public"]["Tables"]["objectives"]["Row"] & {
  owner: { full_name: string | null } | null
  key_results: KR[]
}

const STATUSES = options(["on_track", "at_risk", "off_track", "done"] as const)

function currentQuarter() {
  const d = new Date()
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
}

function krProgress(kr: KR) {
  const span = Number(kr.target_value) - Number(kr.start_value)
  if (span === 0) return Number(kr.current_value) >= Number(kr.target_value) ? 100 : 0
  return Math.max(0, Math.min(100, ((Number(kr.current_value) - Number(kr.start_value)) / span) * 100))
}

export function OkrBoard({
  objectives,
  founders,
}: {
  objectives: Objective[]
  founders: { id: string; full_name: string | null; email: string }[]
}) {
  const editable = useCan()("planning.edit")
  const [editingState, setEditingState] = useState<Objective | "new" | null>(null)
  const [requested, clearRequest] = useNewParam("objective")
  const editing = editingState ?? (requested && editable ? "new" : null)
  const setEditing = (value: Objective | "new" | null) => {
    setEditingState(value)
    if (value === null) clearRequest()
  }
  const [krFor, setKrFor] = useState<{ objectiveId: string; kr?: KR } | null>(null)
  const periods = [...new Set(objectives.map((o) => o.period))]

  return (
    <div className="flex flex-col gap-6">
      {editable && (
        <Button className="self-end" onClick={() => setEditing("new")}>
          <PlusIcon data-icon="inline-start" />
          New objective
        </Button>
      )}
      {objectives.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No objectives yet</EmptyTitle>
            <EmptyDescription>Set 1–3 objectives for {currentQuarter()} with measurable key results.</EmptyDescription>
          </EmptyHeader>
          {editable && (
            <EmptyContent>
              <Button variant="outline" onClick={() => setEditing("new")}>
                New objective
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}
      {periods.map((period) => (
        <section key={period} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{period}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {objectives
              .filter((o) => o.period === period)
              .map((o) => (
                <ObjectiveCard
                  key={o.id}
                  objective={o}
                  editable={editable}
                  onEdit={() => setEditing(o)}
                  onAddKr={(kr) => setKrFor({ objectiveId: o.id, kr })}
                />
              ))}
          </div>
        </section>
      ))}

      <ObjectiveDialog objective={editing} founders={founders} onClose={() => setEditing(null)} />
      <KrDialog target={krFor} onClose={() => setKrFor(null)} />
    </div>
  )
}

function ObjectiveCard({
  objective,
  editable,
  onEdit,
  onAddKr,
}: {
  objective: Objective
  editable: boolean
  onEdit: () => void
  onAddKr: (kr?: KR) => void
}) {
  const [, startTransition] = useTransition()
  const overall = objective.key_results.length
    ? Math.round(objective.key_results.reduce((s, kr) => s + krProgress(kr), 0) / objective.key_results.length)
    : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              objective.status === "off_track"
                ? "destructive"
                : objective.status === "at_risk"
                  ? "secondary"
                  : "default"
            }
          >
            {labelize(objective.status)}
          </Badge>
          <span className="text-xs text-muted-foreground">{objective.owner?.full_name ?? "Unassigned"}</span>
        </div>
        <CardTitle className="mt-2">{objective.title}</CardTitle>
        {objective.description && <CardDescription>{objective.description}</CardDescription>}
        {editable && (
          <CardAction>
            <Button variant="ghost" size="icon-sm" onClick={onEdit}>
              <PencilIcon />
              <span className="sr-only">Edit objective</span>
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Progress value={overall} className="flex-1" aria-label="Objective progress" />
          <span className="w-10 text-right text-sm font-medium tabular-nums">{overall}%</span>
        </div>
        {objective.key_results.map((kr) => (
          <div key={kr.id} className="flex flex-col gap-1.5 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2 text-sm">
              <button
                type="button"
                className="text-left font-medium enabled:hover:underline"
                disabled={!editable}
                onClick={() => onAddKr(kr)}
              >
                {kr.title}
              </button>
              {editable && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => startTransition(async () => void (await deleteRow("key_results", kr.id, "/okrs")))}
                >
                  <Trash2Icon />
                  <span className="sr-only">Delete key result</span>
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Progress value={krProgress(kr)} className="flex-1" aria-label={kr.title} />
              <Input
                type="number"
                step="any"
                defaultValue={kr.current_value}
                readOnly={!editable}
                className="h-7 w-24 text-right tabular-nums"
                aria-label={`Current value for ${kr.title}`}
                onBlur={(e) => {
                  const value = Number(e.target.value)
                  if (value === Number(kr.current_value)) return
                  startTransition(async () => {
                    const r = await saveRow("key_results", kr.id, { current_value: value }, "/okrs")
                    if (!r.ok) toast.error("Couldn't update", { description: r.error })
                  })
                }}
              />
              <span className="w-24 text-xs text-muted-foreground">
                / {kr.target_value} {kr.unit}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
      {editable && (
        <CardFooter>
          <Button variant="outline" size="sm" onClick={() => onAddKr()}>
            <PlusIcon data-icon="inline-start" />
            Key result
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

function ObjectiveDialog({
  objective,
  founders,
  onClose,
}: {
  objective: Objective | "new" | null
  founders: { id: string; full_name: string | null; email: string }[]
  onClose: () => void
}) {
  const [pending, startTransition] = useTransition()
  const current = objective && objective !== "new" ? objective : null

  return (
    <Dialog open={objective !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{current ? "Edit objective" : "New objective"}</DialogTitle>
          <DialogDescription>Qualitative and inspiring. Key results make it measurable.</DialogDescription>
        </DialogHeader>
        <form
          key={current?.id ?? "new"}
          className="flex flex-col gap-6"
          action={(fd) =>
            startTransition(async () => {
              const get = (k: string) => String(fd.get(k) ?? "").trim()
              const r = await saveRow(
                "objectives",
                current?.id ?? null,
                {
                  title: get("title"),
                  description: get("description"),
                  period: get("period"),
                  owner_id: get("owner_id"),
                  status: get("status") || "on_track",
                },
                "/okrs"
              )
              if (!r.ok) toast.error("Couldn't save", { description: r.error })
              else onClose()
            })
          }
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="o-title">Objective</FieldLabel>
              <Input
                id="o-title"
                name="title"
                required
                defaultValue={current?.title}
                placeholder="Prove paying demand for Human-on-the-Loop intake"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="o-description">Why it matters</FieldLabel>
              <Textarea id="o-description" name="description" rows={2} defaultValue={current?.description ?? ""} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="o-period">Period</FieldLabel>
                <Input id="o-period" name="period" required defaultValue={current?.period ?? currentQuarter()} />
              </Field>
              <Field>
                <FieldLabel htmlFor="o-owner">Owner</FieldLabel>
                <SimpleSelect
                  id="o-owner"
                  name="owner_id"
                  options={founders.map((f) => ({ value: f.id, label: f.full_name ?? f.email }))}
                  defaultValue={current?.owner_id}
                  allowEmpty
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="o-status">Status</FieldLabel>
                <SimpleSelect
                  id="o-status"
                  name="status"
                  options={STATUSES}
                  defaultValue={current?.status ?? "on_track"}
                />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter className="sm:justify-between">
            {current ? (
              <ConfirmDialog
                title="Delete this objective?"
                description="Its key results are deleted too."
                onConfirm={async () => {
                  await deleteRow("objectives", current.id, "/okrs")
                  onClose()
                }}
                trigger={
                  <Button type="button" variant="ghost">
                    Delete
                  </Button>
                }
              />
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function KrDialog({ target, onClose }: { target: { objectiveId: string; kr?: KR } | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition()
  const kr = target?.kr

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kr ? "Edit key result" : "New key result"}</DialogTitle>
          <DialogDescription>A number that moves from a start value to a target.</DialogDescription>
        </DialogHeader>
        <form
          key={kr?.id ?? target?.objectiveId}
          className="flex flex-col gap-6"
          action={(fd) =>
            startTransition(async () => {
              const get = (k: string) => String(fd.get(k) ?? "").trim()
              const r = await saveRow(
                "key_results",
                kr?.id ?? null,
                {
                  objective_id: target!.objectiveId,
                  title: get("title"),
                  start_value: Number(get("start_value") || 0),
                  target_value: Number(get("target_value")),
                  current_value: Number(get("current_value") || get("start_value") || 0),
                  unit: get("unit"),
                },
                "/okrs"
              )
              if (!r.ok) toast.error("Couldn't save", { description: r.error })
              else onClose()
            })
          }
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="kr-title">Key result</FieldLabel>
              <Input id="kr-title" name="title" required defaultValue={kr?.title} placeholder="Signed paid pilots" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="kr-start">Start</FieldLabel>
                <Input id="kr-start" name="start_value" type="number" step="any" defaultValue={kr?.start_value ?? 0} />
              </Field>
              <Field>
                <FieldLabel htmlFor="kr-target">Target</FieldLabel>
                <Input
                  id="kr-target"
                  name="target_value"
                  type="number"
                  step="any"
                  required
                  defaultValue={kr?.target_value}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="kr-current">Current</FieldLabel>
                <Input
                  id="kr-current"
                  name="current_value"
                  type="number"
                  step="any"
                  defaultValue={kr?.current_value ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="kr-unit">Unit</FieldLabel>
                <Input id="kr-unit" name="unit" defaultValue={kr?.unit ?? ""} placeholder="pilots, $, %" />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
