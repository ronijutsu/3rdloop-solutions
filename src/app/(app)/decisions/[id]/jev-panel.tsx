"use client"

import { BotIcon, ChevronDownIcon, GaugeIcon, RefreshCwIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import type { JevVerdict } from "@/lib/ai/jev"
import type { JevAnalysis } from "@/lib/ai/tasks"
import { fromNow, labelize } from "@/lib/format"

import { askJev } from "../actions"

const STANCE_VARIANT = { approve: "default", reject: "destructive", defer: "secondary" } as const

/**
 * Jev is TypeSafe's System One model: it answers typed questions about the decision with calibrated
 * probabilities. A free OpenRouter model adds a written briefing underneath. Both are shared with the team.
 */
export function JevPanel({
  decisionId,
  verdict,
  jevReady,
  analysis,
  focus,
  analyzedAt,
  canAsk,
}: {
  decisionId: string
  verdict: JevVerdict | null
  jevReady: boolean
  analysis: JevAnalysis | null
  focus: string | null
  analyzedAt: string | null
  canAsk: boolean
}) {
  const [question, setQuestion] = useState("")
  const [pending, startTransition] = useTransition()

  function ask() {
    startTransition(async () => {
      const result = await askJev(decisionId, question)
      if (!result.ok) {
        toast.error("Jev couldn't help right now", { description: result.error })
        return
      }
      if (result.data?.warning) toast.warning(result.data.warning)
      else toast.success("Jev's analysis is ready")
      setQuestion("")
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BotIcon className="size-4" />
          </span>
          Jev
        </CardTitle>
        <CardDescription>
          TypeSafe&apos;s System One model scores this decision with calibrated probabilities; the founders decide.
          {analyzedAt && ` Last analysis ${fromNow(analyzedAt)}${focus ? `, focused on “${focus}”` : ""}.`}
        </CardDescription>
        {(verdict || analysis) && canAsk && (
          <CardAction>
            <Button variant="ghost" size="sm" disabled={pending} onClick={ask}>
              {pending ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
              Refresh
            </Button>
          </CardAction>
        )}
      </CardHeader>

      {!jevReady && (
        <CardContent className="text-sm text-muted-foreground">
          Jev isn&apos;t connected yet. Add <code className="font-mono text-xs">TYPESAFE_API_KEY</code> to{" "}
          <code className="font-mono text-xs">.env.local</code> (keys at console.typesafe.ai).
          {analysis ? " The written briefing below still works." : ""}
        </CardContent>
      )}

      {verdict && <Verdict verdict={verdict} />}

      {analysis && (
        <CardContent className="text-sm">
          <Collapsible defaultOpen={!verdict} className="flex flex-col gap-4">
            <CollapsibleTrigger render={<Button variant="ghost" size="sm" className="-ml-2 self-start" />}>
              <ChevronDownIcon
                data-icon="inline-start"
                className="transition-transform in-data-[panel-open]:rotate-180"
              />
              Written briefing
              <span className="font-normal text-muted-foreground">· free model</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Recommendation</span>
                  <Badge variant={STANCE_VARIANT[analysis.recommendation.stance]}>
                    {labelize(analysis.recommendation.stance)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {labelize(analysis.recommendation.confidence)} confidence
                  </span>
                </div>
                <p>{analysis.recommendation.reasoning}</p>
              </div>

              <p className="text-muted-foreground">{analysis.summary}</p>

              {analysis.options.length > 0 && (
                <Section title="Options">
                  <div className="flex flex-col gap-3">
                    {analysis.options.map((o) => (
                      <div key={o.option} className="flex flex-col gap-1.5">
                        <p className="font-medium">{o.option}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <List label="For" items={o.pros} />
                          <List label="Against" items={o.cons} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {analysis.risks.length > 0 && (
                <Section title="Risks">
                  <ul className="flex flex-col gap-2">
                    {analysis.risks.map((r) => (
                      <li key={r.risk} className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-2">
                          <Badge variant={r.likelihood === "high" ? "destructive" : "outline"}>
                            {labelize(r.likelihood)}
                          </Badge>
                          <span>{r.risk}</span>
                        </span>
                        <span className="pl-1 text-xs text-muted-foreground">Mitigation: {r.mitigation}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {analysis.missing_evidence.length > 0 && (
                <List label="Evidence still missing" items={analysis.missing_evidence} />
              )}
              {analysis.questions_to_resolve.length > 0 && (
                <List label="Questions to settle before voting" items={analysis.questions_to_resolve} />
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      )}

      {canAsk ? (
        <CardFooter className="flex-col items-stretch gap-2">
          {(verdict || analysis) && <Separator className="mb-2" />}
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              ask()
            }}
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                verdict || analysis
                  ? "Ask Jev to focus on something (optional)"
                  : "Anything Jev should focus on? (optional)"
              }
              aria-label="Focus for Jev"
              disabled={pending}
            />
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : <BotIcon data-icon="inline-start" />}
              {pending ? "Jev is thinking…" : verdict || analysis ? "Ask again" : "Ask Jev"}
            </Button>
          </form>
        </CardFooter>
      ) : (
        !verdict && !analysis && <CardContent className="text-sm text-muted-foreground">No analysis yet.</CardContent>
      )}
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      {children}
    </div>
  )
}

function List({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="flex list-disc flex-col gap-0.5 pl-4">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

const pct = (n: number) => `${Math.round(n * 100)}%`

function Verdict({ verdict }: { verdict: JevVerdict }) {
  const { recommendation: rec } = verdict
  const order = ["approve", "defer", "reject"] as const
  return (
    <CardContent className="flex flex-col gap-5 text-sm">
      <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Recommendation</span>
          {rec.decisive ? (
            <Badge variant={STANCE_VARIANT[rec.choice]}>{labelize(rec.choice)}</Badge>
          ) : (
            <Badge variant="outline">Too close to call</Badge>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">{pct(rec.confidence)} confidence</span>
        </div>
        {!rec.decisive && (
          <p className="text-muted-foreground">
            Jev leans {rec.choice}, but not confidently enough to recommend it. Settle the open questions and ask again.
          </p>
        )}
        <div className="flex flex-col gap-1.5" role="list" aria-label="Probability of each outcome">
          {order.map((key) => (
            <div key={key} role="listitem" className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2">
              <span className="text-xs text-muted-foreground">{labelize(key)}</span>
              <Meter value={rec.probabilities[key]} strong={key === rec.choice} />
              <span className="text-right text-xs tabular-nums">{pct(rec.probabilities[key])}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="flex items-center gap-1.5 font-medium">
            <GaugeIcon className="size-4 text-muted-foreground" />
            Readiness
          </p>
          <span className="text-lg font-semibold tabular-nums">{pct(verdict.readiness)}</span>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Weighted from evidence (30%), customer pull (20%), validation-first fit (20%), reversibility (15%), and
          financial safety (15%).
        </p>
        <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {verdict.signals.map((s) => (
            <li key={s.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span>{s.label}</span>
                <span className="text-muted-foreground tabular-nums">{s.level ?? pct(s.value)}</span>
              </div>
              <Meter value={s.value} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          {verdict.model} · {verdict.usage.input_tokens.toLocaleString()} input tokens
        </p>
      </div>
    </CardContent>
  )
}

function Meter({ value, strong = true }: { value: number; strong?: boolean }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div
        className={strong ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-primary/40"}
        style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
      />
    </div>
  )
}
