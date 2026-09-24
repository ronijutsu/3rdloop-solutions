"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { ActionResult } from "@/lib/actions/crud"
import { aiConfigured } from "@/lib/ai/client"
import { draftIdeaAnswer, generateIdeaQuestions } from "@/lib/ai/tasks"
import { authorize, requireMember, requirePermission } from "@/lib/auth"
import { PLAYBOOK, stepInfo } from "@/lib/playbook"

const HYPOTHESIS_FIELDS = [
  "title",
  "target_customer",
  "problem",
  "solution",
  "outcome",
  "why_pay",
  "why_us",
  "assumptions",
] as const

function hypothesisFrom(formData: FormData) {
  const values: Record<string, string | null> = {}
  for (const key of HYPOTHESIS_FIELDS) {
    const v = String(formData.get(key) ?? "").trim()
    values[key] = v || null
  }
  return values as { title: string } & Record<(typeof HYPOTHESIS_FIELDS)[number], string | null>
}

type Supabase = Awaited<ReturnType<typeof requireMember>>["supabase"]

/**
 * Adds questions for the given stages. Uses AI when configured; otherwise
 * falls back to each step's gate question so the gate always has something to check.
 */
async function seedQuestions(
  supabase: Supabase,
  ideaId: string,
  stages: number[],
  { useAI = aiConfigured() }: { useAI?: boolean } = {}
) {
  const { data: idea } = await supabase.from("ideas").select("*").eq("id", ideaId).single()
  if (!idea) throw new Error("Idea not found")

  const { data: existing } = await supabase
    .from("idea_questions")
    .select("question, stage, position")
    .eq("idea_id", ideaId)

  let generated: { stage: number; questions: string[] }[]
  if (useAI) {
    generated = await generateIdeaQuestions(
      idea,
      stages,
      (existing ?? []).map((q) => q.question)
    )
  } else {
    generated = PLAYBOOK.filter((s) => stages.includes(s.step)).map((s) => ({
      stage: s.step,
      questions: [s.gate],
    }))
  }

  const nextPosition = new Map<number, number>()
  for (const q of existing ?? []) {
    nextPosition.set(q.stage, Math.max(nextPosition.get(q.stage) ?? 0, q.position + 1))
  }

  const rows = generated.flatMap(({ stage, questions }) =>
    questions.map((question) => {
      const position = nextPosition.get(stage) ?? 0
      nextPosition.set(stage, position + 1)
      return { idea_id: ideaId, stage, question, source: useAI ? "ai" : "founder", position }
    })
  )
  if (rows.length) {
    const { error } = await supabase.from("idea_questions").insert(rows)
    if (error) throw new Error(error.message)
  }
  return { count: rows.length, usedAI: useAI }
}

export async function createIdea(_: unknown, formData: FormData): Promise<ActionResult> {
  const auth = await authorize("ideas.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const useAI = aiConfigured() && auth.can("ai.use")
  const values = hypothesisFrom(formData)
  if (!values.title) return { ok: false, error: "Give the idea a title" }

  const { data, error } = await supabase.from("ideas").insert(values).select("id").single()
  if (error) return { ok: false, error: error.message }

  const problemId = String(formData.get("problem_id") ?? "")
  if (problemId) {
    await supabase.from("problems").update({ status: "promoted", idea_id: data.id }).eq("id", problemId)
    revalidatePath("/problems")
  }

  try {
    await seedQuestions(
      supabase,
      data.id,
      PLAYBOOK.map((s) => s.step),
      { useAI }
    )
  } catch (e) {
    // The idea exists; questions can be regenerated from its page.
    console.error("Question generation failed", e)
    await seedQuestions(
      supabase,
      data.id,
      PLAYBOOK.map((s) => s.step),
      { useAI: false }
    )
  }
  revalidatePath("/ideas")
  redirect(`/ideas/${data.id}`)
}

export async function updateHypothesis(ideaId: string, formData: FormData): Promise<ActionResult> {
  const auth = await authorize("ideas.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { error } = await supabase.from("ideas").update(hypothesisFrom(formData)).eq("id", ideaId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/ideas/${ideaId}`)
  return { ok: true }
}

export async function generateMoreQuestions(ideaId: string, stage: number): Promise<ActionResult<{ count: number }>> {
  const auth = await authorize("ideas.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  if (!auth.can("ai.use")) return { ok: false, error: "Your role doesn't allow you to use AI features." }
  if (!aiConfigured()) {
    return { ok: false, error: "Set OPENROUTER_API_KEY to generate questions with AI." }
  }
  try {
    const { count } = await seedQuestions(supabase, ideaId, [stage])
    revalidatePath(`/ideas/${ideaId}`)
    return { ok: true, data: { count } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Generation failed" }
  }
}

export async function addQuestion(ideaId: string, stage: number, question: string): Promise<ActionResult> {
  const auth = await authorize("ideas.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const text = question.trim()
  if (!text) return { ok: false, error: "Write a question first" }
  const { count } = await supabase
    .from("idea_questions")
    .select("id", { count: "exact", head: true })
    .eq("idea_id", ideaId)
    .eq("stage", stage)
  const { error } = await supabase
    .from("idea_questions")
    .insert({ idea_id: ideaId, stage, question: text, source: "founder", position: count ?? 0 })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/ideas/${ideaId}`)
  return { ok: true }
}

export async function aiHelpAnswer(
  questionId: string
): Promise<ActionResult<{ draft: string; howToVerify: string[] }>> {
  const auth = await authorize("ideas.edit")
  if (!auth.ok) return auth
  if (!auth.can("ai.use")) return { ok: false, error: "Your role doesn't allow you to use AI features." }
  if (!aiConfigured()) return { ok: false, error: "Set OPENROUTER_API_KEY to use AI Help." }
  const { supabase } = auth

  const { data: question } = await supabase.from("idea_questions").select("*").eq("id", questionId).single()
  if (!question) return { ok: false, error: "Question not found" }
  const [{ data: idea }, { data: answered }] = await Promise.all([
    supabase.from("ideas").select("*").eq("id", question.idea_id).single(),
    supabase
      .from("idea_questions")
      .select("question, answer")
      .eq("idea_id", question.idea_id)
      .not("answer", "is", null)
      .neq("id", questionId)
      .order("stage")
      .limit(30),
  ])
  if (!idea) return { ok: false, error: "Idea not found" }

  try {
    const result = await draftIdeaAnswer({
      idea,
      stepTitle: stepInfo(question.stage).title,
      question: question.question,
      answered: (answered ?? []).map((a) => ({ question: a.question, answer: a.answer ?? "" })),
    })
    // Stored with the question so the suggestion survives navigation and the whole team sees it.
    const { error } = await supabase
      .from("idea_questions")
      .update({ ai_suggestion: result.draft, ai_tips: result.how_to_verify, ai_suggested_at: new Date().toISOString() })
      .eq("id", questionId)
    if (error) return { ok: false, error: error.message }
    revalidatePath(`/ideas/${question.idea_id}`)
    return { ok: true, data: { draft: result.draft, howToVerify: result.how_to_verify } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI Help failed" }
  }
}

export async function dismissSuggestion(questionId: string): Promise<ActionResult> {
  const auth = await authorize("ideas.edit")
  if (!auth.ok) return auth
  const { data, error } = await auth.supabase
    .from("idea_questions")
    .update({ ai_suggestion: null, ai_tips: [], ai_suggested_at: null })
    .eq("id", questionId)
    .select("idea_id")
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/ideas/${data.idea_id}`)
  return { ok: true }
}

export async function answerQuestion(questionId: string, answer: string): Promise<ActionResult> {
  const auth = await authorize("ideas.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { data, error } = await supabase
    .from("idea_questions")
    .update({ answer })
    .eq("id", questionId)
    .select("idea_id")
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/ideas/${data.idea_id}`)
  return { ok: true }
}

export async function setQuestionRequired(questionId: string, required: boolean): Promise<ActionResult> {
  const auth = await authorize("ideas.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { data, error } = await supabase
    .from("idea_questions")
    .update({ required })
    .eq("id", questionId)
    .select("idea_id")
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/ideas/${data.idea_id}`)
  return { ok: true }
}

export async function deleteQuestion(questionId: string): Promise<ActionResult> {
  const auth = await authorize("ideas.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { data, error } = await supabase.from("idea_questions").delete().eq("id", questionId).select("idea_id").single()
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/ideas/${data.idea_id}`)
  return { ok: true }
}

/** Reopens an earlier step. Moving forward only happens through completeStep. */
export async function moveToStage(ideaId: string, stage: number): Promise<ActionResult> {
  const auth = await authorize("ideas.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { data: idea } = await supabase.from("ideas").select("stage").eq("id", ideaId).single()
  if (!idea) return { ok: false, error: "Idea not found" }
  if (stage < 1 || stage >= idea.stage) return { ok: false, error: "Finish the current step to move forward." }
  const { error } = await supabase.from("ideas").update({ stage }).eq("id", ideaId)
  if (error) {
    // The database enforces the question gate; surface its message as-is.
    return { ok: false, error: error.message.replace(/^IDEA_GATE:\s*/, "") }
  }
  revalidatePath(`/ideas/${ideaId}`)
  revalidatePath("/ideas")
  return { ok: true }
}

export async function setIdeaStatus(
  ideaId: string,
  status: "active" | "parked" | "killed" | "scaled"
): Promise<ActionResult> {
  const auth = await authorize("ideas.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { error } = await supabase.from("ideas").update({ status }).eq("id", ideaId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/ideas/${ideaId}`)
  revalidatePath("/ideas")
  return { ok: true }
}

export async function recordStageReview(
  ideaId: string,
  stage: number,
  verdict: "go" | "no_go" | "revisit",
  notes: string
): Promise<ActionResult> {
  const auth = await authorize("ideas.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { error } = await supabase
    .from("idea_stage_reviews")
    .insert({ idea_id: ideaId, stage, verdict, notes: notes.trim() || null })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/ideas/${ideaId}`)
  return { ok: true }
}

/**
 * Finishes the idea's current playbook step with a go / revisit / no-go call.
 * "go" advances to the next step (the database gate still applies) and, on the
 * final step, marks the idea as scaled. "no_go" parks the idea.
 */
export async function completeStep(
  ideaId: string,
  verdict: "go" | "no_go" | "revisit",
  notes: string
): Promise<ActionResult<{ stage: number; projectId: string | null }>> {
  const auth = await authorize("ideas.edit")
  if (!auth.ok) return auth
  const { supabase } = auth

  const { data: idea } = await supabase.from("ideas").select("stage").eq("id", ideaId).single()
  if (!idea) return { ok: false, error: "Idea not found" }

  // Advance first so a gate failure doesn't leave a "go" review behind.
  let stage = idea.stage
  if (verdict === "go") {
    const update = idea.stage < 10 ? { stage: idea.stage + 1 } : { status: "scaled" as const }
    const { error } = await supabase.from("ideas").update(update).eq("id", ideaId)
    if (error) return { ok: false, error: error.message.replace(/^IDEA_GATE:\s*/, "") }
    stage = Math.min(idea.stage + 1, 10)
  } else if (verdict === "no_go") {
    await supabase.from("ideas").update({ status: "parked" }).eq("id", ideaId)
  }

  const { error } = await supabase
    .from("idea_stage_reviews")
    .insert({ idea_id: ideaId, stage: idea.stage, verdict, notes: notes.trim() || null })
  if (error) return { ok: false, error: error.message }

  // Reaching Build opens a project for the idea (database trigger); report it so the UI can link to it.
  let projectId: string | null = null
  if (verdict === "go" && idea.stage < 8 && stage >= 8) {
    const { data: project } = await supabase.from("projects").select("id").eq("idea_id", ideaId).maybeSingle()
    projectId = project?.id ?? null
    revalidatePath("/projects")
  }

  revalidatePath(`/ideas/${ideaId}`)
  revalidatePath("/ideas")
  return { ok: true, data: { stage, projectId } }
}

export async function deleteIdea(ideaId: string) {
  const { supabase } = await requirePermission("ideas.edit")
  await supabase.from("ideas").delete().eq("id", ideaId)
  revalidatePath("/ideas")
  redirect("/ideas")
}
