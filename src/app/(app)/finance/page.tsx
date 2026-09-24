import { format, startOfMonth, subMonths } from "date-fns"
import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth"

import { FinanceView } from "./finance-view"

export const metadata: Metadata = { title: "Financial Tracker" }

export default async function FinancePage() {
  const { supabase, can } = await requirePermission("finance.view")
  const [{ data: transactions }, { data: projects }, { data: budgets }] = await Promise.all([
    supabase.from("transactions").select("*, project:projects(id, name)").order("occurred_on", { ascending: false }),
    supabase.from("projects").select("id, name").order("name"),
    supabase
      .from("budgets")
      .select("*, budget_lines(*), decision:decisions(id, status, decision_votes(choice))")
      .order("month", { ascending: false })
      .order("created_at", { ascending: false }),
  ])
  const rows = transactions ?? []

  // Last six calendar months, oldest first.
  const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(new Date(), 5 - i)))
  const monthly = months.map((m) => {
    const key = format(m, "yyyy-MM")
    const inMonth = rows.filter((t) => t.occurred_on.startsWith(key))
    const sum = (kind: string) => inMonth.filter((t) => t.kind === kind).reduce((s, t) => s + Number(t.amount), 0)
    return { month: format(m, "MMM"), income: sum("income"), expenses: sum("expense") }
  })

  const recurring = rows.filter((t) => t.recurring !== "none")
  const monthlyOf = (kind: string) =>
    recurring
      .filter((t) => t.kind === kind)
      .reduce((s, t) => s + (t.recurring === "yearly" ? Number(t.amount) / 12 : Number(t.amount)), 0)

  const last3 = monthly.slice(-4, -1)
  const avgBurn = last3.reduce((s, m) => s + (m.expenses - m.income), 0) / Math.max(last3.length, 1)
  const balance = rows.reduce((s, t) => s + (t.kind === "income" ? 1 : -1) * Number(t.amount), 0)

  return (
    <>
      <PageHeader
        title="Financial Tracker"
        description="Income, expenses, recurring costs, and runway. All amounts in Philippine pesos (₱)."
      />
      <FinanceView
        transactions={rows}
        budgets={budgets ?? []}
        canProposeBudget={can("finance.edit") && can("decisions.create")}
        projects={projects ?? []}
        monthly={monthly}
        stats={{
          thisMonth: monthly[monthly.length - 1],
          mrr: monthlyOf("income"),
          recurringCosts: monthlyOf("expense"),
          avgBurn,
          balance,
        }}
      />
    </>
  )
}
