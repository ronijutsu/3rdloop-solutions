"use client"

import { addMonths, format, parseISO, startOfMonth, subMonths } from "date-fns"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, VoteIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { SimpleSelect } from "@/components/simple-select"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { EXPENSE_CATEGORIES } from "@/lib/constants"
import { formatMoney, labelize } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"
import { useNewParam } from "@/hooks/use-new-param"

import { proposeBudget } from "./actions"

type Tables = Database["public"]["Tables"]
export type Budget = Tables["budgets"]["Row"] & {
  budget_lines: Tables["budget_lines"]["Row"][]
  decision: { id: string; status: string; decision_votes: { choice: string }[] } | null
}
type Expense = { occurred_on: string; kind: string; category: string; amount: number }

const monthKey = (d: Date) => format(d, "yyyy-MM")

export function BudgetPlanner({
  budgets,
  transactions,
  canPropose,
}: {
  budgets: Budget[]
  transactions: Expense[]
  canPropose: boolean
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [proposingState, setProposingState] = useState(false)
  const [requested, clearRequest] = useNewParam("budget")
  const proposing = proposingState || (requested && canPropose)
  const setProposing = (value: boolean) => {
    setProposingState(value)
    if (!value) clearRequest()
  }
  const key = monthKey(month)

  const forMonth = budgets.filter((b) => b.month.startsWith(key))
  const active = forMonth.find((b) => b.status === "approved")
  const pending = forMonth.filter((b) => b.status === "proposed")
  const history = forMonth.filter((b) => !["approved", "proposed"].includes(b.status))

  const spentBy = new Map<string, number>()
  for (const t of transactions) {
    if (t.kind !== "expense" || !t.occurred_on.startsWith(key)) continue
    spentBy.set(t.category, (spentBy.get(t.category) ?? 0) + Number(t.amount))
  }

  const lines = active?.budget_lines ?? []
  const budgeted = new Set(lines.map((l) => l.category))
  const unbudgeted = [...spentBy].filter(([category]) => !budgeted.has(category))
  const totalBudget = lines.reduce((s, l) => s + Number(l.amount), 0)
  const totalSpent = [...spentBy.values()].reduce((s, v) => s + v, 0)

  // Pre-fill a proposal from this month's budget, else the previous approved one, else last month's spending.
  function starterLines() {
    if (active) return active.budget_lines.map((l) => ({ category: l.category, amount: Number(l.amount), notes: "" }))
    const previous = budgets
      .filter((b) => b.status === "approved" && b.month < `${key}-01`)
      .sort((a, b) => b.month.localeCompare(a.month))[0]
    if (previous)
      return previous.budget_lines.map((l) => ({ category: l.category, amount: Number(l.amount), notes: "" }))
    const lastKey = monthKey(subMonths(month, 1))
    const spent = new Map<string, number>()
    for (const t of transactions)
      if (t.kind === "expense" && t.occurred_on.startsWith(lastKey))
        spent.set(t.category, (spent.get(t.category) ?? 0) + Number(t.amount))
    const fromSpend = [...spent].map(([category, amount]) => ({
      category,
      amount: Math.ceil(amount / 1000) * 1000,
      notes: "",
    }))
    return fromSpend.length ? fromSpend : [{ category: "Software", amount: 0, notes: "" }]
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => subMonths(m, 1))}>
          <ChevronLeftIcon />
          <span className="sr-only">Previous month</span>
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRightIcon />
          <span className="sr-only">Next month</span>
        </Button>
        <h2 className="text-lg font-semibold tracking-tight">{format(month, "MMMM yyyy")}</h2>
        {monthKey(month) !== monthKey(new Date()) && (
          <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            This month
          </Button>
        )}
        {canPropose && (
          <Button className="ml-auto" onClick={() => setProposing(true)}>
            <PlusIcon data-icon="inline-start" />
            Propose budget
          </Button>
        )}
      </div>

      {pending.map((b) => {
        const total = b.budget_lines.reduce((s, l) => s + Number(l.amount), 0)
        const votes = b.decision?.decision_votes ?? []
        return (
          <Alert key={b.id}>
            <VoteIcon />
            <AlertTitle>A {formatMoney(total)} budget is waiting for approval</AlertTitle>
            <AlertDescription>
              {votes.filter((v) => v.choice === "approve").length} approve ·{" "}
              {votes.filter((v) => v.choice === "reject").length} reject so far. It becomes active when a majority of
              voting members approve.
            </AlertDescription>
            {b.decision_id && (
              <AlertAction>
                <Button size="sm" variant="outline" render={<Link href={`/decisions/${b.decision_id}`} />}>
                  Open vote
                </Button>
              </AlertAction>
            )}
          </Alert>
        )
      })}

      {!active ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No approved budget for {format(month, "MMMM")}</EmptyTitle>
            <EmptyDescription>
              {pending.length
                ? "A proposal is open for voting."
                : `Spent so far: ${formatMoney(totalSpent)}. Propose a budget and the founders vote on it in Decisions.`}
            </EmptyDescription>
          </EmptyHeader>
          {canPropose && pending.length === 0 && (
            <EmptyContent>
              <Button variant="outline" onClick={() => setProposing(true)}>
                <PlusIcon data-icon="inline-start" />
                Propose a {format(month, "MMMM")} budget
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Budget vs actual</CardTitle>
            <CardDescription>
              {formatMoney(totalSpent)} of {formatMoney(totalBudget)} spent
              {totalSpent > totalBudget && ` · ${formatMoney(totalSpent - totalBudget)} over`}
            </CardDescription>
            {active.decision_id && (
              <CardAction>
                <Button variant="ghost" size="sm" render={<Link href={`/decisions/${active.decision_id}`} />}>
                  Approval vote
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="hidden w-48 sm:table-cell">
                    <span className="sr-only">Progress</span>
                  </TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const spent = spentBy.get(line.category) ?? 0
                  const amount = Number(line.amount)
                  const over = spent > amount
                  return (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div className="font-medium">{line.category}</div>
                        {line.notes && <div className="text-xs text-muted-foreground">{line.notes}</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(spent)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Progress
                          value={amount ? Math.min(100, (spent / amount) * 100) : spent ? 100 : 0}
                          className={cn(over && "[&_[data-slot=progress-indicator]]:bg-destructive")}
                          aria-label={`${line.category} spent`}
                        />
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums", over && "font-medium text-destructive")}>
                        {over ? `−${formatMoney(spent - amount)}` : formatMoney(amount - spent)}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {unbudgeted.map(([category, spent]) => (
                  <TableRow key={category}>
                    <TableCell>
                      <div className="font-medium">{category}</div>
                      <div className="text-xs text-destructive">Not in the budget</div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">—</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(spent)}</TableCell>
                    <TableCell className="hidden sm:table-cell" />
                    <TableCell className="text-right font-medium text-destructive tabular-nums">
                      −{formatMoney(spent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(totalBudget)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(totalSpent)}</TableCell>
                  <TableCell className="hidden sm:table-cell" />
                  <TableCell className={cn("text-right tabular-nums", totalSpent > totalBudget && "text-destructive")}>
                    {totalSpent > totalBudget
                      ? `−${formatMoney(totalSpent - totalBudget)}`
                      : formatMoney(totalBudget - totalSpent)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Earlier proposals this month:{" "}
          {history.map((b, i) => (
            <span key={b.id}>
              {i > 0 && ", "}
              {b.decision_id ? (
                <Link href={`/decisions/${b.decision_id}`} className="underline underline-offset-4">
                  {formatMoney(b.budget_lines.reduce((s, l) => s + Number(l.amount), 0))} ({labelize(b.status)})
                </Link>
              ) : (
                `${labelize(b.status)}`
              )}
            </span>
          ))}
        </p>
      )}

      {proposing && <ProposeDialog month={month} starter={starterLines()} onClose={() => setProposing(false)} />}
    </div>
  )
}

function ProposeDialog({
  month,
  starter,
  onClose,
}: {
  month: Date
  starter: { category: string; amount: number; notes: string }[]
  onClose: () => void
}) {
  const router = useRouter()
  const [target, setTarget] = useState(monthKey(month))
  const [lines, setLines] = useState(starter)
  const [notes, setNotes] = useState("")
  const [pending, startTransition] = useTransition()
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const used = new Set(lines.map((l) => l.category))
  const update = (i: number, patch: Partial<(typeof lines)[number]>) =>
    setLines((all) => all.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Propose a budget</DialogTitle>
          <DialogDescription>
            This opens a decision. The budget becomes active once a majority of voting members approve it.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          action={() =>
            startTransition(async () => {
              const result = await proposeBudget({ month: target, notes, lines })
              if (!result.ok) {
                toast.error("Couldn't propose budget", { description: result.error })
                return
              }
              toast.success(`${format(parseISO(`${target}-01`), "MMMM")} budget proposed`, {
                description: `${formatMoney(total)} is now up for a vote.`,
                action: { label: "Open vote", onClick: () => router.push(`/decisions/${result.data?.decisionId}`) },
              })
              onClose()
            })
          }
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="budget-month">Month</FieldLabel>
              <Input
                id="budget-month"
                type="month"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-48"
                required
              />
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Spending by category</FieldLegend>
              <div className="flex flex-col gap-2">
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,10rem)_minmax(0,9rem)_1fr_2rem] items-center gap-2">
                    <SimpleSelect
                      size="sm"
                      options={EXPENSE_CATEGORIES.filter((c) => c === line.category || !used.has(c)).map((c) => ({
                        value: c,
                        label: c,
                      }))}
                      value={line.category}
                      onValueChange={(category) => update(i, { category })}
                    />
                    <InputGroup>
                      <InputGroupAddon>₱</InputGroupAddon>
                      <InputGroupInput
                        type="number"
                        min={0}
                        step={500}
                        value={line.amount || ""}
                        onChange={(e) => update(i, { amount: Number(e.target.value) })}
                        aria-label={`${line.category} amount`}
                      />
                    </InputGroup>
                    <Input
                      value={line.notes}
                      onChange={(e) => update(i, { notes: e.target.value })}
                      placeholder="Note (optional)"
                      aria-label={`${line.category} note`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={lines.length === 1}
                      onClick={() => setLines((all) => all.filter((_, j) => j !== i))}
                    >
                      <XIcon />
                      <span className="sr-only">Remove {line.category}</span>
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={used.size >= EXPENSE_CATEGORIES.length}
                    onClick={() =>
                      setLines((all) => [
                        ...all,
                        { category: EXPENSE_CATEGORIES.find((c) => !used.has(c)) ?? "Other", amount: 0, notes: "" },
                      ])
                    }
                  >
                    <PlusIcon data-icon="inline-start" />
                    Add category
                  </Button>
                  <span className="text-sm">
                    Total <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
                  </span>
                </div>
              </div>
            </FieldSet>
            <Field>
              <FieldLabel htmlFor="budget-notes">Why this budget?</FieldLabel>
              <Textarea
                id="budget-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What changed from last month, and what this spending should achieve"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || total <= 0}>
              {pending && <Spinner data-icon="inline-start" />}
              Propose for vote
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
