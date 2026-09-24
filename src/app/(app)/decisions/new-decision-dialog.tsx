"use client"

import { PlusIcon } from "lucide-react"
import { useActionState, useState } from "react"

import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { ActionResult } from "@/lib/actions/crud"
import { useNewParam } from "@/hooks/use-new-param"

import { createDecision } from "./actions"

export function NewDecisionDialog({
  ideas,
  defaultIdea,
}: {
  ideas: { id: string; title: string }[]
  defaultIdea?: string
}) {
  const [openState, setOpenState] = useState(Boolean(defaultIdea))
  const [requested, clearRequest] = useNewParam("decision")
  const open = openState || requested
  const setOpen = (value: boolean) => {
    setOpenState(value)
    if (!value) clearRequest()
  }
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(createDecision, undefined)
  const idea = ideas.find((i) => i.id === defaultIdea)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        New decision
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Raise a decision</DialogTitle>
          <DialogDescription>Frame it as a yes/no question the founders can approve or reject.</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-6">
          <FieldGroup>
            {state && !state.ok && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel htmlFor="d-title">Question</FieldLabel>
              <Input
                id="d-title"
                name="title"
                required
                defaultValue={idea ? `Advance “${idea.title}” to the next step?` : ""}
                placeholder="Should we run a paid pilot with Acme?"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="d-description">Context</FieldLabel>
              <Textarea
                id="d-description"
                name="description"
                rows={3}
                placeholder="What's the situation and what does approving mean?"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="d-options">Options considered</FieldLabel>
              <Textarea id="d-options" name="options_considered" rows={2} placeholder="Alternatives and trade-offs" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="d-idea">Related idea</FieldLabel>
                <SimpleSelect
                  id="d-idea"
                  name="idea_id"
                  options={ideas.map((i) => ({ value: i.id, label: i.title }))}
                  defaultValue={defaultIdea}
                  allowEmpty
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="d-closes">Voting closes</FieldLabel>
                <Input id="d-closes" name="closes_at" type="date" />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Open for voting
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
