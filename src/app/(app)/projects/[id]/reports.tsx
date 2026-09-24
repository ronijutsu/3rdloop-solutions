"use client"

import { parseISO, subDays } from "date-fns"
import { useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { SimpleSelect } from "@/components/simple-select"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  burndown,
  burnup,
  cumulativeFlow,
  flowTimes,
  statusTimelines,
  velocity,
  workload,
  type Person,
  type Sprint,
} from "@/lib/agile"

import type { Activity, Project, ProjectTask } from "./project-view"

// Colors follow the validated chart tokens (see globals.css); identity is always backed by a legend.
const burndownConfig = {
  remaining: { label: "Remaining", color: "var(--chart-1)" },
  ideal: { label: "Ideal", color: "var(--muted-foreground)" },
} satisfies ChartConfig
const velocityConfig = {
  committed: { label: "Committed", color: "var(--chart-2)" },
  completed: { label: "Completed", color: "var(--chart-1)" },
} satisfies ChartConfig
const flowConfig = {
  done: { label: "Done", color: "var(--chart-1)" },
  review: { label: "In review", color: "var(--chart-2)" },
  in_progress: { label: "In progress", color: "var(--chart-3)" },
  todo: { label: "To do", color: "var(--chart-5)" },
} satisfies ChartConfig
const burnupConfig = {
  scope: { label: "Scope", color: "var(--chart-2)" },
  done: { label: "Done", color: "var(--chart-1)" },
} satisfies ChartConfig
const cycleConfig = { tasks: { label: "Tasks", color: "var(--chart-1)" } } satisfies ChartConfig
const workloadConfig = {
  doing: { label: "In flight", color: "var(--chart-1)" },
  todo: { label: "Not started", color: "var(--chart-2)" },
} satisfies ChartConfig

const axis = { tickLine: false, axisLine: false, tickMargin: 8 } as const

export function Reports({
  project,
  sprints,
  tasks,
  people,
  activity,
}: {
  project: Project
  sprints: Sprint[]
  tasks: ProjectTask[]
  people: Person[]
  activity: Activity[]
}) {
  const timelines = statusTimelines(activity)
  const charted = sprints.filter((s) => s.status !== "planned" && s.start_date && s.end_date)
  const [sprintId, setSprintId] = useState(
    () => (sprints.find((s) => s.status === "active") ?? charted.at(-1))?.id ?? ""
  )
  const sprint = charted.find((s) => s.id === sprintId) ?? null

  // Flow charts cover the project's life, capped to the last 60 days.
  const earliest = tasks.reduce((min, t) => (t.created_at < min ? t.created_at : min), new Date().toISOString())
  const start =
    project.start_date && project.start_date > earliest.slice(0, 10) ? parseISO(project.start_date) : parseISO(earliest)
  const from = start < subDays(new Date(), 60) ? subDays(new Date(), 60) : start

  const burn = sprint ? burndown(sprint, tasks, timelines) : []
  const vel = velocity(sprints, tasks)
  const flow = cumulativeFlow(tasks, timelines, from)
  const up = burnup(tasks, timelines, from)
  const times = flowTimes(tasks)
  const load = workload(tasks, people)

  const finished = vel.filter((v) => !v.active)
  const avgVelocity = finished.length
    ? Math.round(finished.slice(-3).reduce((n, v) => n + v.completed, 0) / Math.min(3, finished.length))
    : null
  const throughput = tasks.filter((t) => t.completed_at && parseISO(t.completed_at) > subDays(new Date(), 14)).length
  const open = tasks.filter((t) => t.status !== "done").length
  const unestimated = tasks.filter((t) => t.status !== "done" && t.story_points === null).length

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Avg velocity"
          value={avgVelocity === null ? "—" : `${avgVelocity} pts`}
          hint={
            finished.length
              ? `Last ${Math.min(3, finished.length)} completed sprint${finished.length > 1 ? "s" : ""}`
              : "No completed sprints yet"
          }
        />
        <Stat label="Throughput" value={String(throughput)} hint="Tasks finished in 14 days" />
        <Stat
          label="Cycle time"
          value={times.cycleAvg === null ? "—" : `${times.cycleAvg} d`}
          hint="Started → done, average"
        />
        <Stat
          label="Lead time"
          value={times.leadAvg === null ? "—" : `${times.leadAvg} d`}
          hint="Created → done, average"
        />
        <Stat
          label="Open work"
          value={String(open)}
          hint={unestimated ? `${unestimated} not estimated` : "All estimated"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sprint burndown</CardTitle>
            <CardDescription>Story points left each day against the ideal pace.</CardDescription>
            {charted.length > 1 && (
              <CardAction>
                <SimpleSelect
                  size="sm"
                  value={sprintId}
                  onValueChange={setSprintId}
                  options={charted.map((s) => ({ value: s.id, label: s.name }))}
                  className="w-36"
                />
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {burn.length ? (
              <ChartContainer config={burndownConfig} className="h-64 w-full">
                <LineChart data={burn} margin={{ left: 0, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.5} />
                  <XAxis dataKey="day" {...axis} minTickGap={24} />
                  <YAxis {...axis} width={32} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line dataKey="ideal" stroke="var(--color-ideal)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  <Line
                    dataKey="remaining"
                    stroke="var(--color-remaining)"
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: "var(--color-remaining)" }}
                    connectNulls={false}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <NoData>Start a sprint to see its burndown.</NoData>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Velocity</CardTitle>
            <CardDescription>Points committed at sprint start vs points completed.</CardDescription>
          </CardHeader>
          <CardContent>
            {vel.length ? (
              <ChartContainer config={velocityConfig} className="h-64 w-full">
                <BarChart data={vel} barGap={2} margin={{ left: 0, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.5} />
                  <XAxis dataKey="sprint" {...axis} />
                  <YAxis {...axis} width={32} allowDecimals={false} />
                  <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="committed" fill="var(--color-committed)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="completed" fill="var(--color-completed)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ChartContainer>
            ) : (
              <NoData>Velocity appears once a sprint has started.</NoData>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cumulative flow</CardTitle>
            <CardDescription>
              Tasks in each status per day. A widening middle band means work is piling up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={flowConfig} className="h-64 w-full">
              <AreaChart data={flow} margin={{ left: 0, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="day" {...axis} minTickGap={32} />
                <YAxis {...axis} width={32} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <ChartLegend content={<ChartLegendContent />} />
                {(["done", "review", "in_progress", "todo"] as const).map((key) => (
                  <Area
                    key={key}
                    dataKey={key}
                    stackId="flow"
                    type="stepAfter"
                    fill={`var(--color-${key})`}
                    fillOpacity={0.85}
                    stroke={`var(--color-${key})`}
                    strokeWidth={1}
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Burnup</CardTitle>
            <CardDescription>Total scope vs work done, in points. The gap is what&apos;s left.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={burnupConfig} className="h-64 w-full">
              <LineChart data={up} margin={{ left: 0, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="day" {...axis} minTickGap={32} />
                <YAxis {...axis} width={32} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line dataKey="scope" type="stepAfter" stroke="var(--color-scope)" strokeWidth={2} dot={false} />
                <Line dataKey="done" type="stepAfter" stroke="var(--color-done)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cycle time</CardTitle>
            <CardDescription>
              How long finished tasks took from start to done{times.finished ? ` (${times.finished} tasks)` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {times.finished ? (
              <ChartContainer config={cycleConfig} className="h-56 w-full">
                <BarChart data={times.buckets} margin={{ left: 0, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.5} />
                  <XAxis dataKey="range" {...axis} />
                  <YAxis {...axis} width={32} allowDecimals={false} />
                  <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent hideIndicator />} />
                  <Bar dataKey="tasks" fill="var(--color-tasks)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ChartContainer>
            ) : (
              <NoData>Finish a task to see cycle times.</NoData>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workload</CardTitle>
            <CardDescription>Open story points per person. Shared tasks count for everyone on them.</CardDescription>
          </CardHeader>
          <CardContent>
            {load.length ? (
              <ChartContainer
                config={workloadConfig}
                className="w-full"
                style={{ height: Math.max(160, load.length * 44 + 60) }}
              >
                <BarChart data={load} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <CartesianGrid horizontal={false} strokeOpacity={0.5} />
                  <XAxis type="number" {...axis} allowDecimals={false} />
                  <YAxis type="category" dataKey="person" {...axis} width={84} />
                  <ChartTooltip cursor={{ fillOpacity: 0.4 }} content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                    dataKey="doing"
                    stackId="w"
                    fill="var(--color-doing)"
                    stroke="var(--card)"
                    strokeWidth={2}
                    maxBarSize={24}
                  />
                  <Bar
                    dataKey="todo"
                    stackId="w"
                    fill="var(--color-todo)"
                    stroke="var(--card)"
                    strokeWidth={2}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <NoData>No open work assigned.</NoData>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">
        Unestimated tasks count as 1 point in the burndown, burnup, and workload charts so they stay visible.
      </p>
    </>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
    </Card>
  )
}

function NoData({ children }: { children: React.ReactNode }) {
  return <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">{children}</p>
}
