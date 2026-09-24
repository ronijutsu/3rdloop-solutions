"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { ActionResult } from "@/lib/actions/crud"
import { aiConfigured } from "@/lib/ai/client"
import { assessDecision, jevConfigured } from "@/lib/ai/jev"
import { analyzeDecision } from "@/lib/ai/tasks"
import { authorize } from "@/lib/auth"
import { formatMoney } from "@/lib/format"

export async function createDecision(_: unknown, formData: FormData): Promise<ActionResult> {
  const auth = await authorize("decisions.create")
  if (!auth.ok) return auth
  const { supabase } = auth
  const get = (k: string) => String(formData.get(k) ?? "").trim() || null
  const title = get("title")
  if (!title) return { ok: false, error: "Title is required" }

  const closes = get("closes_at")
  const { data, error } = await supabase
    .from("decisions")
    .insert({
      title,
      description: get("description"),
      options_considered: get("options_considered"),
      idea_id: get("idea_id"),
      closes_at: closes ? new Date(`${closes}T23:59:59`).toISOString() : null,
    })
    .select("id")
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath("/decisions")
  redirect(`/decisions/${data.id}`)
}

export async function castVote(
  decisionId: string,
  choice: "approve" | "reject" | "abstain",
  comment: string
): Promise<ActionResult> {
  const auth = await authorize("decisions.vote")
  if (!auth.ok) return auth
  const { supabase, profile } = auth
  const { error } = await supabase
    .from("decision_votes")
    .upsert({ decision_id: decisionId, voter_id: profile.id, choice, comment: comment.trim() || null })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/decisions/${decisionId}`)
  revalidatePath("/decisions")
  return { ok: true }
}

export async function retractVote(decisionId: string): Promise<ActionResult> {
  const auth = await authorize("decisions.vote")
  if (!auth.ok) return auth
  const { supabase, profile } = auth
  const { error } = await supabase
    .from("decision_votes")
    .delete()
    .eq("decision_id", decisionId)
    .eq("voter_id", profile.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/decisions/${decisionId}`)
  return { ok: true }
}

export async function setDecisionWithdrawn(decisionId: string, withdrawn: boolean): Promise<ActionResult> {
  const auth = await authorize("decisions.create")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { error } = await supabase
    .from("decisions")
    .update({ status: withdrawn ? "withdrawn" : "open", decided_at: null })
    .eq("id", decisionId)
  if (error) return { ok: false, error: error.message }
  // Votes cast before it was withdrawn still count once it's reopened.
  if (!withdrawn) await supabase.rpc("recount_decision", { d_id: decisionId })
  revalidatePath(`/decisions/${decisionId}`)
  revalidatePath("/decisions")
  return { ok: true }
}

export async function saveOutcomeNotes(decisionId: string, notes: string): Promise<ActionResult> {
  const auth = await authorize("decisions.create")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { error } = await supabase
    .from("decisions")
    .update({ outcome_notes: notes.trim() || null })
    .eq("id", decisionId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/decisions/${decisionId}`)
  return { ok: true }
}

/** Asks Jev, the AI decision advisor, to analyse a decision. The result is stored on the decision. */
export async function askJev(decisionId: string, focus: string): Promise<ActionResult<{ warning?: string }>> {
  const auth = await authorize("decisions.view")
  if (!auth.ok) return auth
  if (!auth.can("ai.use")) return { ok: false, error: "Your role doesn't allow you to use AI features." }
  const useJev = jevConfigured()
  const useBriefing = aiConfigured()
  if (!useJev && !useBriefing)
    return { ok: false, error: "Set TYPESAFE_API_KEY (and OPENROUTER_API_KEY for the briefing)." }
  const { supabase } = auth

  const { data: decision } = await supabase
    .from("decisions")
    .select("*, decision_votes(choice, comment, voter:profiles(full_name))")
    .eq("id", decisionId)
    .single()
  if (!decision) return { ok: false, error: "Decision not found" }

  const sections = [
    `Decision: ${decision.title}`,
    `Status: ${decision.status}${decision.closes_at ? ` (voting closes ${decision.closes_at.slice(0, 10)})` : ""}`,
    `Context: ${decision.description ?? "none given"}`,
    decision.options_considered && `Options the founders listed: ${decision.options_considered}`,
  ]

  const votes = decision.decision_votes
  sections.push(
    votes.length
      ? `Votes so far:\n${votes.map((v) => `- ${v.voter?.full_name ?? "Founder"}: ${v.choice}${v.comment ? ` — "${v.comment}"` : ""}`).join("\n")}`
      : "No votes yet."
  )

  if (decision.idea_id) {
    const [{ data: idea }, { data: answers }] = await Promise.all([
      supabase.from("ideas").select("*").eq("id", decision.idea_id).single(),
      supabase
        .from("idea_questions")
        .select("stage, question, answer")
        .eq("idea_id", decision.idea_id)
        .not("answer", "is", null)
        .order("stage")
        .limit(40),
    ])
    if (idea) {
      sections.push(
        `Linked idea: ${idea.title} (playbook step ${idea.stage} of 10, status ${idea.status})
Hypothesis: customer = ${idea.target_customer ?? "?"}; problem = ${idea.problem ?? "?"}; solution = ${idea.solution ?? "?"}; outcome = ${idea.outcome ?? "?"}; why pay = ${idea.why_pay ?? "?"}; assumptions = ${idea.assumptions ?? "?"}`,
        answers?.length
          ? `Founders' answers so far:\n${answers.map((a) => `- [step ${a.stage}] ${a.question}\n  ${a.answer}`).join("\n")}`
          : "No playbook questions answered yet."
      )
    }
  }

  const { data: budget } = await supabase
    .from("budgets")
    .select("month, budget_lines(category, amount)")
    .eq("decision_id", decisionId)
    .maybeSingle()
  if (budget) {
    const month = budget.month.slice(0, 7)
    const previous = new Date(`${budget.month}T00:00:00`)
    previous.setMonth(previous.getMonth() - 1)
    const prevKey = previous.toISOString().slice(0, 7)
    const { data: spend } = await supabase
      .from("transactions")
      .select("category, amount, occurred_on")
      .eq("kind", "expense")
      .gte("occurred_on", `${prevKey}-01`)
      .lt("occurred_on", `${month}-01`)
    const actual = new Map<string, number>()
    for (const t of spend ?? []) actual.set(t.category, (actual.get(t.category) ?? 0) + Number(t.amount))
    sections.push(
      `This is a budget proposal for ${month}:\n${budget.budget_lines.map((l) => `- ${l.category}: ${formatMoney(l.amount)} (spent last month: ${formatMoney(actual.get(l.category) ?? 0)})`).join("\n")}`
    )
  }

  const state = sections.filter(Boolean).join("\n\n")
  const trimmedFocus = focus.trim()
  // Jev (TypeSafe) gives the calibrated verdict; a free OpenRouter model writes the briefing. Either may fail alone.
  const [verdict, briefing] = await Promise.allSettled([
    useJev
      ? assessDecision(trimmedFocus ? `${state}\n\nThe founders asked Jev to focus on: ${trimmedFocus}` : state)
      : Promise.resolve(null),
    useBriefing ? analyzeDecision(state, trimmedFocus || undefined) : Promise.resolve(null),
  ])
  const failure = (r: PromiseSettledResult<unknown>) =>
    r.status === "rejected" ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : null
  const verdictValue = verdict.status === "fulfilled" ? verdict.value : null
  const briefingValue = briefing.status === "fulfilled" ? briefing.value : null
  if (!verdictValue && !briefingValue) {
    return { ok: false, error: failure(verdict) ?? failure(briefing) ?? "Jev couldn't analyse this decision" }
  }

  const { error } = await supabase.rpc("save_jev_review", {
    p_decision: decisionId,
    p_verdict: verdictValue,
    p_briefing: briefingValue,
    p_focus: focus,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/decisions/${decisionId}`)
  const partial = failure(verdict)
    ? `Jev's verdict failed (${failure(verdict)}); the briefing was updated.`
    : failure(briefing)
      ? "Jev's verdict is ready; the written briefing couldn't be refreshed."
      : undefined
  return { ok: true, data: { warning: partial } }
}
