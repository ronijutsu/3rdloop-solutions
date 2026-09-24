"use client"

import { CheckIcon, LockIcon } from "lucide-react"
import { useActionState, useRef, useState, useTransition, type FormEvent } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { Database } from "@/lib/supabase/database.types"

import { submitResponse, type SubmitState } from "./actions"

type Question = Database["public"]["Tables"]["survey_questions"]["Row"]

const REQUIRED_MESSAGE = "This question needs an answer."

function missingRequired(questions: Question[], form: FormData) {
  return questions.filter((q) => {
    if (!q.required) return false
    const values = form.getAll(`q-${q.id}`).map((v) => String(v).trim())
    return values.every((v) => v === "")
  })
}

export function SurveyForm({ surveyId, questions }: { surveyId: string; questions: Question[] }) {
  const [state, submit] = useActionState<SubmitState, FormData>(submitResponse.bind(null, surveyId), undefined)
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Set<string>>(new Set())
  const form = useRef<HTMLFormElement>(null)

  // A server-side rejection points at one question; show it inline like client-side checks.
  const invalid = state?.questionId ? new Set([...errors, state.questionId]) : errors
  const clear = (id: string) =>
    setErrors((current) => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })

  function focusQuestion(id: string) {
    const block = document.getElementById(`question-${id}`)
    block?.scrollIntoView({ behavior: "smooth", block: "center" })
    block
      ?.querySelector<HTMLElement>(
        "input:not([type=hidden]):not([aria-hidden=true]), textarea, [role=radio], [role=checkbox]"
      )
      ?.focus({ preventScroll: true })
  }

  // Submitting through a transition (not the form's action prop) keeps every answer
  // on screen if anything is rejected; React only auto-resets forms it submits itself.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const missing = missingRequired(questions, data)
    if (missing.length) {
      setErrors(new Set(missing.map((q) => q.id)))
      focusQuestion(missing[0].id)
      return
    }
    setErrors(new Set())
    startTransition(() => submit(data))
  }

  if (state?.ok) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-8">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckIcon className="size-5" />
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-balance">Thank you, that&apos;s everything.</h2>
        <p className="max-w-prose text-muted-foreground">
          Your answers go straight to the founders and shape what we build next. You can close this page.
        </p>
      </div>
    )
  }

  const requiredCount = questions.filter((q) => q.required).length

  return (
    <form ref={form} onSubmit={onSubmit} noValidate className="flex flex-col gap-10">
      <p className="text-sm text-muted-foreground">
        {questions.length} question{questions.length === 1 ? "" : "s"}
        {requiredCount > 0 && (
          <>
            {" "}
            · <span className="text-destructive">*</span> required
          </>
        )}
      </p>

      {state && !state.ok && !state.questionId && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <ol className="flex flex-col gap-10">
        {questions.map((q, index) => (
          <li key={q.id} id={`question-${q.id}`} className="scroll-mt-24 border-t pt-8 first:border-t-0 first:pt-0">
            <QuestionBlock question={q} number={index + 1} invalid={invalid.has(q.id)} onAnswer={() => clear(q.id)} />
          </li>
        ))}
      </ol>

      <Separator />

      <FieldGroup className="gap-5">
        <div className="flex flex-col gap-1">
          <p className="font-medium">Can we follow up?</p>
          <p className="text-sm text-muted-foreground">Optional. Leave these blank to stay anonymous.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="respondent_name">Your name</FieldLabel>
            <Input id="respondent_name" name="respondent_name" autoComplete="name" />
          </Field>
          <Field>
            <FieldLabel htmlFor="respondent_email">Email</FieldLabel>
            <Input id="respondent_email" name="respondent_email" type="email" autoComplete="email" />
          </Field>
        </div>
      </FieldGroup>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LockIcon className="size-3.5 shrink-0" />
          Only the 3rdLoop founders see your answers.
        </p>
        <Button type="submit" size="lg" className="w-full sm:w-auto sm:min-w-40" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {pending ? "Sending…" : "Submit answers"}
        </Button>
      </div>
      {invalid.size > 0 && (
        <p role="status" className="-mt-6 text-sm text-destructive sm:text-right">
          {invalid.size === 1
            ? "One question still needs an answer."
            : `${invalid.size} questions still need an answer.`}
        </p>
      )}
    </form>
  )
}

function QuestionBlock({
  question: q,
  number,
  invalid,
  onAnswer,
}: {
  question: Question
  number: number
  invalid: boolean
  onAnswer: () => void
}) {
  const name = `q-${q.id}`
  const errorId = `${name}-error`
  const prompt = (
    <span className="flex gap-3 text-base leading-snug font-medium text-balance">
      <span className="w-5 shrink-0 text-muted-foreground tabular-nums">{number}</span>
      <span>
        {q.prompt}
        {q.required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </span>
    </span>
  )
  const error = invalid && (
    <FieldError id={errorId} className="pl-8">
      {REQUIRED_MESSAGE}
    </FieldError>
  )

  if (q.kind === "single" || q.kind === "multi") {
    return (
      <FieldSet data-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}>
        <FieldLegend className="mb-3">{prompt}</FieldLegend>
        {q.kind === "single" ? (
          <RadioGroup name={name} onValueChange={onAnswer} className="gap-2 pl-8 sm:grid-cols-2" aria-invalid={invalid}>
            {q.options.map((option) => (
              <ChoiceTile key={option} id={`${name}-${option}`} label={option}>
                <RadioGroupItem value={option} id={`${name}-${option}`} aria-invalid={invalid} />
              </ChoiceTile>
            ))}
          </RadioGroup>
        ) : (
          <div className="grid gap-2 pl-8 sm:grid-cols-2">
            {q.options.map((option) => (
              <ChoiceTile key={option} id={`${name}-${option}`} label={option}>
                <Checkbox
                  name={name}
                  value={option}
                  id={`${name}-${option}`}
                  onCheckedChange={onAnswer}
                  aria-invalid={invalid}
                />
              </ChoiceTile>
            ))}
          </div>
        )}
        {q.kind === "multi" && !invalid && <p className="pl-8 text-sm text-muted-foreground">Select all that apply.</p>}
        {error}
      </FieldSet>
    )
  }

  if (q.kind === "scale") {
    return (
      <FieldSet data-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined}>
        <FieldLegend className="mb-3">{prompt}</FieldLegend>
        <div className="flex flex-col gap-2 pl-8">
          <RadioGroup name={name} onValueChange={onAnswer} className="grid max-w-md grid-cols-5 gap-2">
            {["1", "2", "3", "4", "5"].map((value) => (
              <FieldLabel
                key={value}
                htmlFor={`${name}-${value}`}
                className="cursor-pointer justify-center text-base tabular-nums *:data-[slot=field]:py-3"
              >
                <Field orientation="horizontal" className="justify-center">
                  <RadioGroupItem value={value} id={`${name}-${value}`} className="sr-only" aria-invalid={invalid} />
                  <FieldTitle>{value}</FieldTitle>
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
          <div className="flex max-w-md justify-between text-xs text-muted-foreground">
            <span>Not at all</span>
            <span>Extremely</span>
          </div>
        </div>
        {error}
      </FieldSet>
    )
  }

  return (
    <Field data-invalid={invalid || undefined} className="data-[invalid=true]:text-foreground">
      <FieldLabel htmlFor={name} className="w-full">
        {prompt}
      </FieldLabel>
      <div className="pl-8">
        {q.kind === "long_text" ? (
          <Textarea
            id={name}
            name={name}
            rows={5}
            onChange={onAnswer}
            aria-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
            className="min-h-32"
          />
        ) : (
          <Input
            id={name}
            name={name}
            onChange={onAnswer}
            aria-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
          />
        )}
      </div>
      {error}
    </Field>
  )
}

/** A full-width, tappable option row; the control inside carries the checked state. */
function ChoiceTile({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <FieldLabel htmlFor={id} className="cursor-pointer">
      <Field orientation="horizontal" className="items-center gap-3 py-3">
        {children}
        <FieldTitle className="font-normal">{label}</FieldTitle>
      </Field>
    </FieldLabel>
  )
}
