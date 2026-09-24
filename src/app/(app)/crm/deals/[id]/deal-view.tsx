"use client"

import { ArrowLeftIcon, PencilIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { useCan } from "@/components/permissions-provider"
import { SimpleSelect } from "@/components/simple-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { deleteRow } from "@/lib/actions/crud"
import { formatDate, formatMoney, fromNow, labelize } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

import { logActivity, moveDeal, toggleActivity } from "../../actions"
import { DealDialog } from "../../pipeline-board"

type Tables = Database["public"]["Tables"]
type Deal = Tables["deals"]["Row"] & {
  company: Tables["companies"]["Row"] | null
  contact: Tables["contacts"]["Row"] | null
  owner: { full_name: string | null } | null
}
type Activity = Tables["activities"]["Row"] & { author: { full_name: string | null } | null }
type Kind = "note" | "call" | "email" | "meeting" | "task"

export function DealView({
  deal,
  pipeline,
  activities,
  companies,
  contacts,
}: {
  deal: Deal
  pipeline: Tables["pipelines"]["Row"] & { stages: Tables["pipeline_stages"]["Row"][] }
  activities: Activity[]
  companies: { id: string; name: string }[]
  contacts: { id: string; full_name: string }[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [kind, setKind] = useState<Kind>("note")
  const [body, setBody] = useState("")
  const [due, setDue] = useState("")
  const [pending, startTransition] = useTransition()
  const editable = useCan()("crm.edit")
  const stage = pipeline.stages.find((s) => s.id === deal.stage_id)

  return (
    <>
      <Button variant="ghost" size="sm" className="self-start" render={<Link href={`/crm?pipeline=${pipeline.id}`} />}>
        <ArrowLeftIcon data-icon="inline-start" />
        {pipeline.name}
      </Button>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={stage?.kind === "won" ? "default" : stage?.kind === "lost" ? "destructive" : "secondary"}>
              {stage?.name}
            </Badge>
            <span className="text-sm text-muted-foreground">{stage?.probability}% probability</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>
          <p className="text-3xl font-semibold tabular-nums">{formatMoney(deal.value)}</p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <SimpleSelect
              className="w-44"
              options={pipeline.stages.map((s) => ({ value: s.id, label: s.name }))}
              value={deal.stage_id}
              onValueChange={(stageId) =>
                startTransition(async () => {
                  const r = await moveDeal(deal.id, stageId)
                  if (!r.ok) toast.error("Couldn't move deal", { description: r.error })
                })
              }
            />
            <Button variant="outline" onClick={() => setEditing(true)}>
              <PencilIcon data-icon="inline-start" />
              Edit
            </Button>
            <ConfirmDialog
              title="Delete this deal?"
              description="Its activity history is deleted too."
              onConfirm={async () => {
                await deleteRow("deals", deal.id, "/crm")
                router.push(`/crm?pipeline=${pipeline.id}`)
              }}
              trigger={
                <Button variant="ghost" size="icon">
                  <Trash2Icon />
                  <span className="sr-only">Delete deal</span>
                </Button>
              }
            />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Calls, emails, meetings, and follow-up tasks.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {editable && (
              <FieldGroup className="gap-3 rounded-lg border p-3">
                <ToggleGroup
                  value={[kind]}
                  onValueChange={(v) => v[0] && setKind(v[0] as Kind)}
                  variant="outline"
                  size="sm"
                >
                  {(["note", "call", "email", "meeting", "task"] as const).map((k) => (
                    <ToggleGroupItem key={k} value={k}>
                      {labelize(k)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  placeholder="What happened? What's next?"
                  aria-label="Activity"
                />
                <div className="flex flex-wrap items-end gap-2">
                  {kind === "task" && (
                    <Field className="w-auto">
                      <FieldLabel htmlFor="due">Due</FieldLabel>
                      <Input id="due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
                    </Field>
                  )}
                  <Button
                    className="ml-auto"
                    disabled={pending || !body.trim()}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await logActivity(
                          { deal_id: deal.id },
                          kind,
                          body,
                          kind === "task" ? due || null : null
                        )
                        if (!r.ok) toast.error("Couldn't log activity", { description: r.error })
                        else {
                          setBody("")
                          setDue("")
                        }
                      })
                    }
                  >
                    Log {kind}
                  </Button>
                </div>
              </FieldGroup>
            )}
            <ol className="flex flex-col gap-4">
              {activities.length === 0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
              {activities.map((a) => (
                <li key={a.id} className="flex gap-3">
                  {a.kind === "task" ? (
                    <Checkbox
                      checked={a.done}
                      disabled={!editable}
                      onCheckedChange={(checked) =>
                        startTransition(async () => void (await toggleActivity(a.id, Boolean(checked))))
                      }
                      aria-label="Mark task done"
                      className="mt-0.5"
                    />
                  ) : (
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{labelize(a.kind)}</Badge>
                      <span>
                        {a.author?.full_name ?? "Founder"} · {fromNow(a.created_at)}
                      </span>
                      {a.due_at && <span>· due {formatDate(a.due_at, "MMM d, h:mm a")}</span>}
                    </div>
                    <p className={cn("text-sm whitespace-pre-wrap", a.done && "text-muted-foreground line-through")}>
                      {a.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Detail label="Company" value={deal.company?.name} />
              <Detail label="Industry" value={deal.company?.industry} />
              <Detail label="Website" value={deal.company?.website} href={deal.company?.website ?? undefined} />
              <Separator />
              <Detail label="Contact" value={deal.contact?.full_name} />
              <Detail label="Title" value={deal.contact?.title} />
              <Detail
                label="Email"
                value={deal.contact?.email}
                href={deal.contact?.email ? `mailto:${deal.contact.email}` : undefined}
              />
              <Separator />
              <Detail label="Expected close" value={deal.expected_close ? formatDate(deal.expected_close) : null} />
              <Detail label="Owner" value={deal.owner?.full_name} />
              {deal.notes && (
                <>
                  <Separator />
                  <p className="whitespace-pre-wrap text-muted-foreground">{deal.notes}</p>
                </>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <DealDialog
        open={editing}
        onOpenChange={setEditing}
        pipeline={pipeline}
        stageId={deal.stage_id}
        companies={companies}
        contacts={contacts}
        deal={deal}
      />
    </>
  )
}

function Detail({ label, value, href }: { label: string; value: string | null | undefined; href?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      {value && href ? (
        <a href={href} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">
          {value}
        </a>
      ) : (
        <span className="truncate text-right">{value || "—"}</span>
      )}
    </div>
  )
}
