"use client"

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, SparklesIcon } from "lucide-react"
import { useActionState, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { ActionResult } from "@/lib/actions/crud"
import { cn } from "@/lib/utils"

import { createIdea } from "./actions"

export const HYPOTHESIS_QUESTIONS = [
  { name: "target_customer", label: "Target customer", hint: "Who exactly? Industry, size, role." },
  { name: "problem", label: "Problem you believe exists", hint: "What happens today, and how often?" },
  { name: "solution", label: "Proposed solution", hint: "What will you offer?" },
  {
    name: "outcome",
    label: "Expected customer outcome",
    hint: "Something measurable: hours saved, revenue, errors avoided.",
  },
  { name: "why_pay", label: "Why customers might pay", hint: "Existing budget, cost of the status quo." },
  { name: "why_us", label: "Why our team can deliver it", hint: "Unfair advantages, experience, access." },
  { name: "assumptions", label: "Assumptions that could make it fail", hint: "List the riskiest first." },
] as const

type FieldName = "title" | (typeof HYPOTHESIS_QUESTIONS)[number]["name"]

const hint = (name: FieldName) => HYPOTHESIS_QUESTIONS.find((q) => q.name === name)
const WIZARD: { title: string; description: string; fields: FieldName[] }[] = [
  { title: "The idea", description: "Name it and say who it's for.", fields: ["title", "target_customer"] },
  { title: "The problem", description: "What's broken today, and what you'd offer.", fields: ["problem", "solution"] },
  { title: "The value", description: "Why it matters enough to pay for.", fields: ["outcome", "why_pay"] },
  { title: "The risk", description: "Why you can win, and what could sink it.", fields: ["why_us", "assumptions"] },
  { title: "Review", description: "Check the hypothesis reads as something you can prove wrong.", fields: [] },
]

export function HypothesisForm({
  initial,
  aiEnabled,
}: {
  initial?: Record<string, string | null>
  aiEnabled: boolean
}) {
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(createIdea, undefined)
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<FieldName, string>>(() => {
    const start = { title: initial?.title ?? "" } as Record<FieldName, string>
    for (const q of HYPOTHESIS_QUESTIONS) start[q.name] = initial?.[q.name] ?? ""
    return start
  })

  const last = step === WIZARD.length - 1
  const current = WIZARD[step]
  const canContinue = step !== 0 || values.title.trim().length > 0
  const set = (name: FieldName, value: string) => setValues((v) => ({ ...v, [name]: value }))

  return (
    <form
      action={action}
      // Enter in a field moves forward instead of submitting a half-finished idea.
      onSubmit={(e) => {
        if (!last) {
          e.preventDefault()
          if (canContinue) setStep(step + 1)
        }
      }}
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
    >
      <ol className="flex items-center gap-2" aria-label="Progress">
        {WIZARD.map((s, i) => (
          <li key={s.title} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={i > step && !canContinue}
              onClick={() => (i <= step || canContinue) && setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                i < step && "border-primary bg-primary text-primary-foreground",
                i === step && "border-primary text-primary ring-3 ring-primary/20",
                i > step && "text-muted-foreground"
              )}
            >
              {i < step ? <CheckIcon className="size-3.5" /> : i + 1}
              <span className="sr-only">{s.title}</span>
            </button>
            <span
              className={cn("hidden truncate text-xs sm:block", i === step ? "font-medium" : "text-muted-foreground")}
            >
              {s.title}
            </span>
            {i < WIZARD.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardDescription>
            Step {step + 1} of {WIZARD.length}
          </CardDescription>
          <CardTitle className="text-lg">{current.title}</CardTitle>
          <CardDescription>{current.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {state && !state.ok && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          {initial?.problem_id && <input type="hidden" name="problem_id" value={initial.problem_id} />}

          {/* Every field stays mounted so the final submit carries all answers. */}
          {WIZARD.slice(0, -1).map((s, i) => (
            <FieldGroup key={s.title} hidden={i !== step}>
              {s.fields.map((name) =>
                name === "title" ? (
                  <Field key={name}>
                    <FieldLabel htmlFor="title">Idea title</FieldLabel>
                    <Input
                      id="title"
                      name="title"
                      value={values.title}
                      onChange={(e) => set("title", e.target.value)}
                      placeholder="AI intake assistant for dental clinics"
                      autoFocus
                    />
                  </Field>
                ) : (
                  <Field key={name}>
                    <FieldLabel htmlFor={name}>{hint(name)?.label}</FieldLabel>
                    <Textarea
                      id={name}
                      name={name}
                      rows={4}
                      value={values[name]}
                      onChange={(e) => set(name, e.target.value)}
                    />
                    <FieldDescription>{hint(name)?.hint}</FieldDescription>
                  </Field>
                )
              )}
            </FieldGroup>
          ))}

          {last && (
            <div className="flex flex-col gap-5">
              <blockquote className="border-l-2 border-primary pl-4 text-base leading-relaxed">
                We believe <Blank value={values.target_customer} /> has <Blank value={values.problem} /> and will pay
                for <Blank value={values.solution} /> because it produces <Blank value={values.outcome} />.
              </blockquote>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {(["why_pay", "why_us", "assumptions"] as const).map((name) => (
                  <div key={name} className="flex flex-col gap-1">
                    <dt className="text-muted-foreground">{hint(name)?.label}</dt>
                    <dd className="whitespace-pre-wrap">{values[name] || "—"}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-muted-foreground">
                {aiEnabled
                  ? "When you create the idea, AI writes critical questions for all 10 playbook steps. You can add your own."
                  : "Each playbook step starts with its gate question. Add your own questions on the next page."}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="mt-6 justify-between">
          <Button type="button" variant="ghost" disabled={step === 0 || pending} onClick={() => setStep(step - 1)}>
            <ArrowLeftIcon data-icon="inline-start" />
            Back
          </Button>
          {last ? (
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
              {pending ? (aiEnabled ? "Generating questions…" : "Creating…") : "Create idea"}
            </Button>
          ) : (
            <Button type="submit" disabled={!canContinue}>
              Continue
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </form>
  )
}

function Blank({ value }: { value: string }) {
  return value.trim() ? (
    <strong className="font-medium">{value.trim()}</strong>
  ) : (
    <span className="rounded bg-muted px-1.5 text-muted-foreground">[missing]</span>
  )
}
