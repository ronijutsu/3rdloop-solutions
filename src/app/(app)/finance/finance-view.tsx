"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { EntityManager, type FieldDef } from "@/components/entity-manager"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants"
import { formatDate, formatMoney, labelize, options } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"

import { BudgetPlanner, type Budget } from "./budget-planner"
import { cn } from "@/lib/utils"

type Transaction = Database["public"]["Tables"]["transactions"]["Row"] & {
  project: { id: string; name: string } | null
}
type Month = { month: string; income: number; expenses: number }

const chartConfig = {
  income: { label: "Income", color: "var(--chart-1)" },
  expenses: { label: "Expenses", color: "var(--chart-2)" },
} satisfies ChartConfig

const CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]

export function FinanceView({
  transactions,
  budgets,
  canProposeBudget,
  projects,
  monthly,
  stats,
}: {
  transactions: Transaction[]
  budgets: Budget[]
  canProposeBudget: boolean
  projects: { id: string; name: string }[]
  monthly: Month[]
  stats: { thisMonth: Month; mrr: number; recurringCosts: number; avgBurn: number; balance: number }
}) {
  const params = useSearchParams()
  const [tab, setTab] = useState(() => params.get("tab") ?? "overview")
  // Quick add: ?new=transactions or ?new=budget opens the matching tab (and its form).
  const requested = params.get("new")
  const forcedTab = requested === "transactions" ? "transactions" : requested === "budget" ? "budget" : null
  const fields: FieldDef[] = [
    {
      name: "kind",
      label: "Type",
      type: "select",
      options: options(["income", "expense"] as const),
      required: true,
      half: true,
      defaultValue: "expense",
    },
    {
      name: "occurred_on",
      label: "Date",
      type: "date",
      required: true,
      half: true,
      defaultValue: new Date().toISOString().slice(0, 10),
    },
    { name: "amount", label: "Amount", type: "number", required: true, half: true },
    {
      name: "category",
      label: "Category",
      type: "select",
      options: CATEGORIES.map((c) => ({ value: c, label: c })),
      required: true,
      half: true,
    },
    {
      name: "recurring",
      label: "Recurring",
      type: "select",
      options: options(["none", "monthly", "yearly"] as const),
      required: true,
      half: true,
      defaultValue: "none",
    },
    { name: "description", label: "Description" },
    {
      name: "project_id",
      label: "Project",
      type: "select",
      options: projects.map((p) => ({ value: p.id, label: p.name })),
    },
  ]
  const net = stats.thisMonth.income - stats.thisMonth.expenses
  const runway = stats.avgBurn > 0 && stats.balance > 0 ? stats.balance / stats.avgBurn : null

  return (
    <Tabs value={forcedTab ?? tab} onValueChange={(v) => setTab(v as string)} className="flex flex-col gap-6">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="budget">Budget</TabsTrigger>
        <TabsTrigger value="transactions">Transactions</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label="Net this month"
            value={formatMoney(net)}
            hint={`${formatMoney(stats.thisMonth.income)} in · ${formatMoney(stats.thisMonth.expenses)} out`}
            tone={net < 0 ? "negative" : undefined}
          />
          <Stat
            label="Recurring revenue"
            value={formatMoney(Math.round(stats.mrr))}
            hint="Monthly, from recurring income"
          />
          <Stat
            label="Recurring costs"
            value={formatMoney(Math.round(stats.recurringCosts))}
            hint="Monthly subscriptions & retainers"
          />
          <Stat
            label="Runway"
            value={runway === null ? "—" : `${runway.toFixed(1)} mo`}
            hint={
              stats.avgBurn > 0 ? `Burn ${formatMoney(Math.round(stats.avgBurn))}/mo (3-mo avg)` : "Not burning cash"
            }
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Income vs expenses</CardTitle>
            <CardDescription>Last six months</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={monthly} barGap={2} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v: number) => (v >= 1000 ? `₱${Math.round(v / 1000)}k` : `₱${v}`)}
                />
                <ChartTooltip
                  cursor={{ fillOpacity: 0.4 }}
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">
                            {chartConfig[name as keyof typeof chartConfig]?.label}
                          </span>
                          <span className="font-medium tabular-nums">{formatMoney(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="budget">
        <BudgetPlanner budgets={budgets} transactions={transactions} canPropose={canProposeBudget} />
      </TabsContent>

      <TabsContent value="transactions">
        <EntityManager
          table="transactions"
          noun="transaction"
          rows={transactions}
          fields={fields}
          revalidate="/finance"
          searchKeys={["description", "category"]}
          columns={[
            { header: "Date", cell: (t) => formatDate(t.occurred_on) },
            {
              header: "Description",
              cell: (t) => (
                <div className="flex flex-col">
                  <span className="font-medium">{t.description || t.category}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.category}
                    {t.project && ` · ${t.project.name}`}
                  </span>
                </div>
              ),
            },
            {
              header: "Recurring",
              className: "hidden md:table-cell",
              cell: (t) => (t.recurring === "none" ? "—" : <Badge variant="outline">{labelize(t.recurring)}</Badge>),
            },
            {
              header: "Amount",
              className: "text-right",
              cell: (t) => (
                <span className={cn("font-medium tabular-nums", t.kind === "expense" && "text-muted-foreground")}>
                  {t.kind === "expense" ? "−" : "+"}
                  {formatMoney(t.amount)}
                </span>
              ),
            },
          ]}
        />
      </TabsContent>
    </Tabs>
  )
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "negative" }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn("text-xl tabular-nums", tone === "negative" && "text-destructive")}>{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  )
}
