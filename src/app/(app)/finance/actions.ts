"use server"

import { format, parseISO } from "date-fns"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { ActionResult } from "@/lib/actions/crud"
import { authorize } from "@/lib/auth"
import { formatMoney } from "@/lib/format"

const Proposal = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Pick a month"),
  notes: z.string().trim().max(2000),
  lines: z
    .array(
      z.object({ category: z.string().trim().min(1), amount: z.number().min(0), notes: z.string().trim().max(500) })
    )
    .min(1, "Add at least one budget line"),
})

/**
 * Proposes a monthly budget. The founders approve it by voting on the decision
 * this opens; the database activates the budget when the decision passes.
 */
export async function proposeBudget(input: z.input<typeof Proposal>): Promise<ActionResult<{ decisionId: string }>> {
  const auth = await authorize("finance.edit")
  if (!auth.ok) return auth
  if (!auth.can("decisions.create")) {
    return { ok: false, error: "Proposing a budget opens a vote, which your role can't do." }
  }
  const parsed = Proposal.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const lines = parsed.data.lines.filter((l) => l.amount > 0)
  if (lines.length === 0) return { ok: false, error: "Give at least one category an amount" }
  const categories = new Set(lines.map((l) => l.category.toLowerCase()))
  if (categories.size !== lines.length) return { ok: false, error: "Each category can only appear once" }

  const month = `${parsed.data.month}-01`
  const label = format(parseISO(month), "MMMM yyyy")
  const total = lines.reduce((sum, l) => sum + l.amount, 0)
  const { supabase } = auth

  const { data: decision, error: decisionError } = await supabase
    .from("decisions")
    .insert({
      title: `Approve the ${label} budget (${formatMoney(total)})`,
      description: [
        `Proposed spending for ${label}:`,
        ...lines.map((l) => `• ${l.category}: ${formatMoney(l.amount)}${l.notes ? ` (${l.notes})` : ""}`),
        parsed.data.notes && `\n${parsed.data.notes}`,
        "\nApproving makes this the active budget for the month.",
      ]
        .filter(Boolean)
        .join("\n"),
    })
    .select("id")
    .single()
  if (decisionError) return { ok: false, error: decisionError.message }

  const { data: budget, error } = await supabase
    .from("budgets")
    .insert({ month, notes: parsed.data.notes || null, decision_id: decision.id })
    .select("id")
    .single()
  if (error) {
    await supabase.from("decisions").delete().eq("id", decision.id)
    return { ok: false, error: error.message }
  }

  const { error: linesError } = await supabase
    .from("budget_lines")
    .insert(
      lines.map((l) => ({ budget_id: budget.id, category: l.category, amount: l.amount, notes: l.notes || null }))
    )
  if (linesError) {
    await supabase.from("budgets").delete().eq("id", budget.id)
    await supabase.from("decisions").delete().eq("id", decision.id)
    return { ok: false, error: linesError.message }
  }

  revalidatePath("/finance")
  revalidatePath("/decisions")
  return { ok: true, data: { decisionId: decision.id } }
}
