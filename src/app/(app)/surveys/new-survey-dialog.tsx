"use client"

import { PlusIcon } from "lucide-react"
import { useActionState, useState } from "react"

import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

import { createSurvey } from "./actions"

export function NewSurveyDialog({ ideas, aiEnabled }: { ideas: { id: string; title: string }[]; aiEnabled: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(createSurvey, undefined)
  const [openState, setOpenState] = useState(false)
  const [requested, clearRequest] = useNewParam("survey")

  return (
    <Dialog
      open={openState || requested}
      onOpenChange={(value) => {
        setOpenState(value)
        if (!value) clearRequest()
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        New survey
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New survey</DialogTitle>
          <DialogDescription>What do you need to learn, and from whom?</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-6">
          <FieldGroup>
            {state && !state.ok && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel htmlFor="s-title">Title</FieldLabel>
              <Input id="s-title" name="title" required placeholder="How clinics handle after-hours patient calls" />
            </Field>
            <Field>
              <FieldLabel htmlFor="s-description">What you want to learn</FieldLabel>
              <Textarea id="s-description" name="description" rows={3} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="s-audience">Audience</FieldLabel>
                <Input id="s-audience" name="audience" placeholder="Practice managers" />
              </Field>
              <Field>
                <FieldLabel htmlFor="s-idea">Related idea</FieldLabel>
                <SimpleSelect
                  id="s-idea"
                  name="idea_id"
                  options={ideas.map((i) => ({ value: i.id, label: i.title }))}
                  allowEmpty
                />
              </Field>
            </div>
            <Field orientation="horizontal" data-disabled={!aiEnabled || undefined}>
              <Checkbox id="s-ai" name="use_ai" defaultChecked={aiEnabled} disabled={!aiEnabled} />
              <FieldLabel htmlFor="s-ai" className="font-normal">
                Draft questions with AI {!aiEnabled && "(needs OPENROUTER_API_KEY)"}
              </FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {pending ? "Creating…" : "Create survey"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
