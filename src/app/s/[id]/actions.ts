"use server"

import { createClient } from "@/lib/supabase/server"

export type SubmitState = { ok: boolean; error?: string; questionId?: string } | undefined

export async function submitResponse(surveyId: string, _: SubmitState, formData: FormData): Promise<SubmitState> {
  const supabase = await createClient()
  const { data: questions } = await supabase
    .from("survey_questions")
    .select("id, kind, required, prompt")
    .eq("survey_id", surveyId)
  if (!questions?.length) return { ok: false, error: "This survey is not accepting responses." }

  const answers: Record<string, string | string[]> = {}
  for (const q of questions) {
    const value =
      q.kind === "multi" ? formData.getAll(`q-${q.id}`).map(String) : String(formData.get(`q-${q.id}`) ?? "").trim()
    const empty = Array.isArray(value) ? value.length === 0 : value === ""
    if (q.required && empty) return { ok: false, error: "This question needs an answer.", questionId: q.id }
    if (!empty) answers[q.id] = value
  }

  const { error } = await supabase.from("survey_responses").insert({
    survey_id: surveyId,
    respondent_name:
      String(formData.get("respondent_name") ?? "")
        .trim()
        .slice(0, 200) || null,
    respondent_email:
      String(formData.get("respondent_email") ?? "")
        .trim()
        .slice(0, 200) || null,
    answers,
  })
  if (error) return { ok: false, error: "This survey is not accepting responses." }
  return { ok: true }
}
