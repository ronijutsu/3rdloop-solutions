"use client"

import { PlusIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useOptimistic, useState, useTransition } from "react"

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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { saveRow } from "@/lib/actions/crud"
import { formatDate, formatMoney } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"
import { useNewParam } from "@/hooks/use-new-param"

import { createPipeline, moveDeal } from "./actions"

type Stage = Database["public"]["Tables"]["pipeline_stages"]["Row"]
type Pipeline = Database["public"]["Tables"]["pipelines"]["Row"] & { stages: Stage[] }
type Deal = Database["public"]["Tables"]["deals"]["Row"] & {
  company: { id: string; name: string } | null
  contact: { id: string; full_name: string } | null
  owner: { full_name: string | null } | null
}

export function PipelineBoard({
  pipelines,
  currentId,
  deals,
  companies,
  contacts,
}: {
  pipelines: Pipeline[]
  currentId: string | null
  deals: Deal[]
  companies: { id: string; name: string }[]
  contacts: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [optimisticDeals, applyMove] = useOptimistic(deals, (state, move: { id: string; stageId: string }) =>
    state.map((d) => (d.id === move.id ? { ...d, stage_id: move.stageId } : d))
  )
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [addingState, setAddingState] = useState<string | null>(null)
  // Quick add (?new=deal) opens a new deal in the first stage.
  const [requested, clearRequest] = useNewParam("deal")
  const editable = useCan()("crm.edit")
  const setAdding = (value: string | null) => {
    setAddingState(value)
    if (value === null) clearRequest()
  }

  const pipeline = pipelines.find((p) => p.id === currentId)
  const adding = addingState ?? (requested && editable ? (pipeline?.stages[0]?.id ?? null) : null)
  if (!pipeline) {
    if (!editable) return <p className="text-sm text-muted-foreground">No pipelines yet.</p>
    return <NewPipelineButton onCreated={(id) => router.push(`/crm?pipeline=${id}`)} />
  }

  const stageById = new Map(pipeline.stages.map((s) => [s.id, s]))
  const open = optimisticDeals.filter((d) => stageById.get(d.stage_id)?.kind === "open")
  const won = optimisticDeals.filter((d) => stageById.get(d.stage_id)?.kind === "won")
  const openValue = open.reduce((sum, d) => sum + Number(d.value), 0)
  const weighted = open.reduce(
    (sum, d) => sum + Number(d.value) * ((stageById.get(d.stage_id)?.probability ?? 0) / 100),
    0
  )
  const wonValue = won.reduce((sum, d) => sum + Number(d.value), 0)
  const closed = optimisticDeals.filter((d) => stageById.get(d.stage_id)?.kind !== "open").length
  const winRate = closed ? Math.round((won.length / closed) * 100) : null

  function drop(stageId: string, dealId: string) {
    setDragOver(null)
    const deal = optimisticDeals.find((d) => d.id === dealId)
    if (!editable || !deal || deal.stage_id === stageId) return
    startTransition(async () => {
      applyMove({ id: dealId, stageId })
      const r = await moveDeal(dealId, stageId)
      if (!r.ok) toast.error("Couldn't move deal", { description: r.error })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={pipeline.id} onValueChange={(id) => router.push(`/crm?pipeline=${id}`)}>
          <TabsList>
            {pipelines.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>
                {p.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {editable && (
          <div className="flex gap-2">
            <NewPipelineButton onCreated={(id) => router.push(`/crm?pipeline=${id}`)} />
            <Button onClick={() => setAdding(pipeline.stages[0]?.id ?? null)}>
              <PlusIcon data-icon="inline-start" />
              Add deal
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Open pipeline"
          value={formatMoney(openValue)}
          hint={`${open.length} deal${open.length === 1 ? "" : "s"}`}
        />
        <Stat label="Weighted forecast" value={formatMoney(Math.round(weighted))} hint="Value × stage probability" />
        <Stat label="Won" value={formatMoney(wonValue)} hint={`${won.length} deal${won.length === 1 ? "" : "s"}`} />
        <Stat label="Win rate" value={winRate === null ? "—" : `${winRate}%`} hint={`${closed} closed`} />
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
        <div className="flex min-w-max gap-3">
          {pipeline.stages.map((stage) => {
            const stageDeals = optimisticDeals.filter((d) => d.stage_id === stage.id)
            const total = stageDeals.reduce((sum, d) => sum + Number(d.value), 0)
            return (
              <section
                key={stage.id}
                aria-label={stage.name}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(stage.id)
                }}
                onDragLeave={() => setDragOver((s) => (s === stage.id ? null : s))}
                onDrop={(e) => drop(stage.id, e.dataTransfer.getData("text/deal"))}
                className={cn(
                  "flex w-72 flex-col gap-2 rounded-xl border bg-muted/40 p-2 transition-colors",
                  dragOver === stage.id && "border-primary bg-primary/5"
                )}
              >
                <header className="flex items-center justify-between gap-2 px-1 py-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{stage.name}</span>
                    <Badge variant="secondary">{stageDeals.length}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatMoney(total)}</span>
                </header>
                <div className="flex min-h-24 flex-col gap-2">
                  {stageDeals.map((deal) => (
                    <Link
                      key={deal.id}
                      href={`/crm/deals/${deal.id}`}
                      draggable={editable}
                      onDragStart={(e) => e.dataTransfer.setData("text/deal", deal.id)}
                      className="rounded-lg border bg-card p-3 text-sm shadow-xs transition-colors hover:border-primary/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">{deal.title}</span>
                        <span className="shrink-0 text-xs font-medium">{formatMoney(deal.value)}</span>
                      </div>
                      <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {deal.company && <span className="truncate">{deal.company.name}</span>}
                        {deal.expected_close && <span>Close {formatDate(deal.expected_close)}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
                {editable && (
                  <Button variant="ghost" size="sm" className="justify-start" onClick={() => setAdding(stage.id)}>
                    <PlusIcon data-icon="inline-start" />
                    Add
                  </Button>
                )}
              </section>
            )
          })}
        </div>
      </div>

      <DealDialog
        open={adding !== null}
        onOpenChange={(o) => !o && setAdding(null)}
        pipeline={pipeline}
        stageId={adding}
        companies={companies}
        contacts={contacts}
      />
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  )
}

const DEFAULT_STAGES = [
  { name: "Lead", probability: 10 },
  { name: "Qualified", probability: 25 },
  { name: "Proposal", probability: 60 },
  { name: "Negotiation", probability: 80 },
]

function NewPipelineButton({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [stages, setStages] = useState(DEFAULT_STAGES)
  const [pending, startTransition] = useTransition()

  function reset() {
    setName("")
    setDescription("")
    setStages(DEFAULT_STAGES)
  }

  function update(index: number, patch: Partial<(typeof DEFAULT_STAGES)[number]>) {
    setStages((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <PlusIcon data-icon="inline-start" />
        New pipeline
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New pipeline</DialogTitle>
          <DialogDescription>
            Define the stages a deal moves through. Won and Lost are added at the end automatically.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          action={() =>
            startTransition(async () => {
              const result = await createPipeline({ name, description, stages })
              if (!result.ok) {
                toast.error("Couldn't create pipeline", { description: result.error })
                return
              }
              toast.success(`${name.trim()} created`)
              setOpen(false)
              reset()
              if (result.data) onCreated(result.data.id)
            })
          }
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="pipeline-name">Name</FieldLabel>
              <Input
                id="pipeline-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Agency partnerships"
                required
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pipeline-description">Description</FieldLabel>
              <Input
                id="pipeline-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What kind of deals live here?"
              />
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Stages</FieldLegend>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-[1fr_6rem_2rem] gap-2 text-xs text-muted-foreground">
                  <span>Stage</span>
                  <span>Win chance</span>
                </div>
                {stages.map((stage, index) => (
                  <div key={index} className="grid grid-cols-[1fr_6rem_2rem] items-center gap-2">
                    <Input
                      value={stage.name}
                      onChange={(e) => update(index, { name: e.target.value })}
                      aria-label={`Stage ${index + 1} name`}
                    />
                    <InputGroup>
                      <InputGroupInput
                        type="number"
                        min={0}
                        max={100}
                        value={stage.probability}
                        onChange={(e) => update(index, { probability: Number(e.target.value) })}
                        aria-label={`Stage ${index + 1} win chance`}
                      />
                      <InputGroupAddon align="inline-end">%</InputGroupAddon>
                    </InputGroup>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={stages.length === 1}
                      onClick={() => setStages((list) => list.filter((_, i) => i !== index))}
                    >
                      <XIcon />
                      <span className="sr-only">Remove stage {index + 1}</span>
                    </Button>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_6rem_2rem] gap-2 text-sm text-muted-foreground">
                  <span className="px-2.5">Won · Lost</span>
                  <span className="px-2.5">100% · 0%</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => setStages((list) => [...list, { name: "", probability: 50 }])}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add stage
                </Button>
              </div>
            </FieldSet>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Spinner data-icon="inline-start" />}
              Create pipeline
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DealDialog({
  open,
  onOpenChange,
  pipeline,
  stageId,
  companies,
  contacts,
  deal,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipeline: Pipeline
  stageId: string | null
  companies: { id: string; name: string }[]
  contacts: { id: string; full_name: string }[]
  deal?: Database["public"]["Tables"]["deals"]["Row"]
}) {
  const [pending, startTransition] = useTransition()

  function submit(fd: FormData) {
    const get = (k: string) => String(fd.get(k) ?? "").trim()
    startTransition(async () => {
      const r = await saveRow(
        "deals",
        deal?.id ?? null,
        {
          pipeline_id: pipeline.id,
          stage_id: get("stage_id") || stageId,
          title: get("title"),
          value: Number(get("value") || 0),
          company_id: get("company_id"),
          contact_id: get("contact_id"),
          expected_close: get("expected_close"),
          notes: get("notes"),
        },
        "/crm"
      )
      if (!r.ok) toast.error("Couldn't save deal", { description: r.error })
      else onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{deal ? "Edit deal" : "New deal"}</DialogTitle>
          <DialogDescription>{pipeline.name}</DialogDescription>
        </DialogHeader>
        <form key={deal?.id ?? stageId} action={submit} className="flex flex-col gap-6">
          <FieldGroup className="grid grid-cols-2 gap-4">
            <Field className="col-span-2">
              <FieldLabel htmlFor="deal-title">Deal name</FieldLabel>
              <Input
                id="deal-title"
                name="title"
                defaultValue={deal?.title}
                required
                placeholder="Acme — AI intake pilot"
              />
            </Field>
            <Field className="col-span-2 sm:col-span-1">
              <FieldLabel htmlFor="deal-value">Value (₱)</FieldLabel>
              <Input id="deal-value" name="value" type="number" min="0" step="any" defaultValue={deal?.value ?? ""} />
            </Field>
            <Field className="col-span-2 sm:col-span-1">
              <FieldLabel htmlFor="deal-stage">Stage</FieldLabel>
              <SimpleSelect
                id="deal-stage"
                name="stage_id"
                options={pipeline.stages.map((s) => ({ value: s.id, label: s.name }))}
                defaultValue={deal?.stage_id ?? stageId}
              />
            </Field>
            <Field className="col-span-2 sm:col-span-1">
              <FieldLabel htmlFor="deal-close">Expected close</FieldLabel>
              <Input id="deal-close" name="expected_close" type="date" defaultValue={deal?.expected_close ?? ""} />
            </Field>
            <Field className="col-span-2 sm:col-span-1">
              <FieldLabel htmlFor="deal-company">Company</FieldLabel>
              <SimpleSelect
                id="deal-company"
                name="company_id"
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
                defaultValue={deal?.company_id}
                allowEmpty
              />
            </Field>
            <Field className="col-span-2 sm:col-span-1">
              <FieldLabel htmlFor="deal-contact">Contact</FieldLabel>
              <SimpleSelect
                id="deal-contact"
                name="contact_id"
                options={contacts.map((c) => ({ value: c.id, label: c.full_name }))}
                defaultValue={deal?.contact_id}
                allowEmpty
              />
            </Field>
            <Field className="col-span-2">
              <FieldLabel htmlFor="deal-notes">Notes</FieldLabel>
              <Textarea id="deal-notes" name="notes" rows={3} defaultValue={deal?.notes ?? ""} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {deal ? "Save" : "Add deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
