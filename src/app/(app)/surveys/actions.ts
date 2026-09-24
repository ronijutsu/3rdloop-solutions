"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { ActionResult } from "@/lib/actions/crud"
import { aiConfigured } from "@/lib/ai/client"
import { draftSurveyQuestions } from "@/lib/ai/tasks"
import { authorize, requirePermission } from "@/lib/auth"

type Kind = "text" | "long_text" | "single" | "multi" | "scale"

export async function createSurvey(_: unknown, formData: FormData): Promise<ActionResult> {
  const auth = await authorize("surveys.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const get = (k: string) => String(formData.get(k) ?? "").trim()
  if (!get("title")) return { ok: false, error: "Give the survey a title" }

  const { data, error } = await supabase
    .from("surveys")
    .insert({ title: get("title"), description: get("description") || null, idea_id: get("idea_id") || null })
    .select("id")
    .single()
  if (error) return { ok: false, error: error.message }

  if (formData.get("use_ai") === "on" && aiConfigured() && auth.can("ai.use")) {
    try {
      const questions = await draftSurveyQuestions({
        goal: get("title") + ". " + get("description"),
        audience: get("audience") || "prospective customers",
      })
      await supabase
        .from("survey_questions")
        .insert(questions.map((q, position) => ({ ...q, survey_id: data.id, position })))
    } catch (e) {
      console.error("Survey drafting failed", e)
    }
  }
  revalidatePath("/surveys")
  redirect(`/surveys/${data.id}`)
}

export async function addSurveyQuestion(surveyId: string, position: number): Promise<ActionResult> {
  const auth = await authorize("surveys.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { error } = await supabase
    .from("survey_questions")
    .insert({ survey_id: surveyId, position, prompt: "New question", kind: "text" })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/surveys/${surveyId}`)
  return { ok: true }
}

export async function updateSurveyQuestion(
  id: string,
  values: { prompt?: string; kind?: Kind; options?: string[]; required?: boolean; position?: number }
): Promise<ActionResult> {
  const auth = await authorize("surveys.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { data, error } = await supabase
    .from("survey_questions")
    .update(values)
    .eq("id", id)
    .select("survey_id")
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/surveys/${data.survey_id}`)
  return { ok: true }
}

export async function removeSurveyQuestion(id: string): Promise<ActionResult> {
  const auth = await authorize("surveys.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { data, error } = await supabase.from("survey_questions").delete().eq("id", id).select("survey_id").single()
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/surveys/${data.survey_id}`)
  return { ok: true }
}

export async function setSurveyStatus(id: string, status: "draft" | "active" | "closed"): Promise<ActionResult> {
  const auth = await authorize("surveys.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  const { error } = await supabase.from("surveys").update({ status }).eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/surveys/${id}`)
  revalidatePath("/surveys")
  return { ok: true }
}

export async function aiAppendQuestions(surveyId: string, audience: string): Promise<ActionResult<{ count: number }>> {
  const auth = await authorize("surveys.edit")
  if (!auth.ok) return auth
  const { supabase } = auth
  if (!auth.can("ai.use")) return { ok: false, error: "Your role doesn't allow you to use AI features." }
  if (!aiConfigured()) return { ok: false, error: "Set OPENROUTER_API_KEY to draft questions with AI." }
  const { data: survey } = await supabase
    .from("surveys")
    .select("title, description, survey_questions(prompt, position)")
    .eq("id", surveyId)
    .single()
  if (!survey) return { ok: false, error: "Survey not found" }
  try {
    const existing = survey.survey_questions.map((q) => q.prompt)
    const questions = await draftSurveyQuestions({
      goal: `${survey.title}. ${survey.description ?? ""}${existing.length ? `\nAlready asked (don't repeat): ${existing.join(" | ")}` : ""}`,
      audience: audience || "prospective customers",
    })
    const start = Math.max(-1, ...survey.survey_questions.map((q) => q.position)) + 1
    await supabase
      .from("survey_questions")
      .insert(questions.map((q, i) => ({ ...q, survey_id: surveyId, position: start + i })))
    revalidatePath(`/surveys/${surveyId}`)
    return { ok: true, data: { count: questions.length } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Drafting failed" }
  }
}

export async function deleteSurvey(id: string) {
  const { supabase } = await requirePermission("surveys.edit")
  await supabase.from("surveys").delete().eq("id", id)
  revalidatePath("/surveys")
  redirect("/surveys")
}
