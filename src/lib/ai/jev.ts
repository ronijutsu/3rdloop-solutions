import "server-only"

import { choice, noul, score, TypeSafeClient } from "@typesafe-ai/sdk"

/**
 * Jev — TypeSafe's System One model (https://docs.typesafe.ai). Instead of writing prose, Jev answers typed
 * questions about a decision with calibrated probabilities. We ask small atomic questions, compose them into a
 * readiness score in code, and gate on Jev's own confidence so a coin-flip never reads like a verdict.
 *
 * Paid per input token (output is free); one decision is a few thousand tokens.
 */

const MODEL = process.env.TYPESAFE_MODEL || "jev-latest"
/** Below this confidence Jev's recommendation is shown as "too close to call". */
const CONFIDENCE_FLOOR = 0.55

export function jevConfigured() {
  return Boolean(process.env.TYPESAFE_API_KEY)
}

const QUESTIONS = {
  recommendation: choice("Given everything in the state, what should the founders do with this decision now?", {
    approve: "Approve: the case is sound, the evidence supports it, and the risks are acceptable.",
    defer: "Defer: promising or plausible, but key evidence is missing or it should wait for more information.",
    reject: "Reject: the case is weak, the risks outweigh the upside, or it conflicts with the plan.",
  }),
  evidence: score("How strong is the evidence behind this decision?", [
    "None: opinions or hunches only.",
    "Anecdotal: a few stories or second-hand signals.",
    "Some: several customer conversations or internal data points.",
    "Solid: multiple independent sources, consistent data.",
    "Hard proof: paid commitments, signed pilots, or measured results.",
  ]),
  reversibility: score("If this turns out to be wrong, how easy is it to undo?", [
    "Irreversible or very costly to undo.",
    "Hard to undo: weeks of work or lost money.",
    "Moderate: some rework or sunk cost.",
    "Easy: can be reversed quickly and cheaply.",
  ]),
  financial_risk: score("How much financial risk does this put on a small bootstrapped company paid in PHP?", [
    "None or trivial spend.",
    "Low: well within the monthly budget.",
    "Material: a noticeable share of the monthly budget.",
    "Severe: threatens runway.",
  ]),
  urgency: score("How time-sensitive is this decision?", [
    "Can wait without cost.",
    "Should be decided within a few weeks.",
    "Needs a decision now; delay has a real cost.",
  ]),
  customer_pull: noul(
    "Is there direct evidence that customers want this: interviews, pre-orders, pilots, or payments?"
  ),
  playbook_fit: noul(
    "Does this respect validation-first discipline: not building or spending heavily before the problem and willingness to pay are validated?"
  ),
  team_alignment: noul("Do the votes and comments so far show the founders broadly agree?"),
}

export type JevSignal = {
  key: string
  label: string
  /** Normalised 0–1 where higher is better for the decision (risk is inverted). */
  value: number
  /** The raw rubric level Jev picked, for score questions. */
  level?: string
  confidence?: number
}

export type JevVerdict = {
  model: string
  recommendation: {
    choice: "approve" | "defer" | "reject"
    confidence: number
    probabilities: Record<"approve" | "defer" | "reject", number>
    /** False when Jev's confidence is below the floor; show it as too close to call. */
    decisive: boolean
  }
  /** Composite 0–1: how ready this decision is to be approved on its merits. */
  readiness: number
  signals: JevSignal[]
  usage: { input_tokens: number; output_tokens: number }
}

/** Weights for the composite readiness score. They sum to 1. */
const WEIGHTS = {
  evidence: 0.3,
  customer_pull: 0.2,
  playbook_fit: 0.2,
  reversibility: 0.15,
  financial_risk: 0.15,
} as const

export async function assessDecision(state: string): Promise<JevVerdict> {
  const client = new TypeSafeClient({ timeout: 60_000 })
  const { answers, model, usage } = await client.systemOne({ model: MODEL, state, questions: QUESTIONS })

  const level = (a: { score: number; legend: Record<string, unknown> }) => {
    const text = a.legend[String(Math.round(a.score))]
    return typeof text === "string" ? text.split(":")[0] : undefined
  }
  const scaled = (a: { score: number }, max: number) => a.score / max

  const signals: JevSignal[] = [
    {
      key: "evidence",
      label: "Evidence strength",
      value: scaled(answers.evidence, 4),
      level: level(answers.evidence),
      confidence: answers.evidence.confidence,
    },
    { key: "customer_pull", label: "Customer pull", value: answers.customer_pull.noul },
    { key: "playbook_fit", label: "Validation-first fit", value: answers.playbook_fit.noul },
    {
      key: "reversibility",
      label: "Reversibility",
      value: scaled(answers.reversibility, 3),
      level: level(answers.reversibility),
      confidence: answers.reversibility.confidence,
    },
    {
      key: "financial_risk",
      label: "Financial safety",
      value: 1 - scaled(answers.financial_risk, 3),
      level: level(answers.financial_risk),
      confidence: answers.financial_risk.confidence,
    },
    { key: "team_alignment", label: "Founder alignment", value: answers.team_alignment.noul },
    {
      key: "urgency",
      label: "Urgency",
      value: scaled(answers.urgency, 2),
      level: level(answers.urgency),
      confidence: answers.urgency.confidence,
    },
  ]

  const byKey = new Map(signals.map((s) => [s.key, s.value]))
  const readiness = Object.entries(WEIGHTS).reduce((sum, [key, w]) => sum + w * (byKey.get(key) ?? 0), 0)

  const rec = answers.recommendation
  return {
    model,
    recommendation: {
      choice: rec.choice,
      confidence: rec.confidence,
      probabilities: { ...rec.probabilities },
      decisive: rec.confidence >= CONFIDENCE_FLOOR,
    },
    readiness,
    signals,
    usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens },
  }
}
