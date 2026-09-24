"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import { EntityManager, type FieldDef } from "@/components/entity-manager"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate, labelize, options } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

type Item = Database["public"]["Tables"]["roadmap_items"]["Row"] & { idea: { id: string; title: string } | null }

const LANES = ["product", "sales", "marketing", "operations", "finance"] as const
const STATUS = ["planned", "in_progress", "done", "dropped"] as const

function quarterOf(date: string) {
  const d = new Date(`${date}T00:00:00`)
  return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`
}

function quarters(items: Item[]) {
  const now = new Date()
  const keys = new Set<string>()
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i * 3, 1)
    keys.add(`${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`)
  }
  for (const item of items) if (item.start_date) keys.add(quarterOf(item.start_date))
  return [...keys].sort()
}

export function RoadmapView({ items, ideas }: { items: Item[]; ideas: { id: string; title: string }[] }) {
  const router = useRouter()
  const [tab, setTab] = useState("board")
  const requested = useSearchParams().get("new") === "roadmap_items"
  const fields: FieldDef[] = [
    { name: "title", label: "Title", required: true },
    { name: "description", label: "Description", type: "textarea" },
    {
      name: "lane",
      label: "Lane",
      type: "select",
      options: options(LANES),
      required: true,
      half: true,
      defaultValue: "product",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: options(STATUS),
      required: true,
      half: true,
      defaultValue: "planned",
    },
    { name: "start_date", label: "Start", type: "date", half: true },
    { name: "end_date", label: "End", type: "date", half: true },
    {
      name: "idea_id",
      label: "Related idea",
      type: "select",
      options: ideas.map((i) => ({ value: i.id, label: i.title })),
    },
  ]
  const cols = quarters(items)
  const unscheduled = items.filter((i) => !i.start_date)

  return (
    <Tabs value={requested ? "list" : tab} onValueChange={(v) => setTab(v as string)}>
      <TabsList>
        <TabsTrigger value="board">Board</TabsTrigger>
        <TabsTrigger value="list">List & edit</TabsTrigger>
      </TabsList>
      <TabsContent value="board" className="mt-4 flex flex-col gap-4">
        <div className="-mx-4 overflow-x-auto px-4 md:-mx-8 md:px-8">
          <div className="grid min-w-max gap-2" style={{ gridTemplateColumns: `8rem repeat(${cols.length}, 15rem)` }}>
            <div />
            {cols.map((q) => (
              <div key={q} className="px-2 text-sm font-medium text-muted-foreground">
                {q}
              </div>
            ))}
            {LANES.map((lane) => (
              <div key={lane} className="contents">
                <div className="py-2 text-sm font-medium">{labelize(lane)}</div>
                {cols.map((q) => {
                  const cell = items.filter((i) => i.lane === lane && i.start_date && quarterOf(i.start_date) === q)
                  return (
                    <div key={q} className="flex min-h-16 flex-col gap-2 rounded-lg bg-muted/40 p-2">
                      {cell.map((item) => (
                        <Link
                          key={item.id}
                          href={`/roadmap/${item.id}`}
                          className={cn(
                            "rounded-md border bg-card p-2 text-xs transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            item.status === "done" && "opacity-60",
                            item.status === "dropped" && "line-through opacity-50"
                          )}
                        >
                          <div className="font-medium">{item.title}</div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
                            <span>{labelize(item.status)}</span>
                            {item.end_date && <span>→ {formatDate(item.end_date, "MMM d")}</span>}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        {unscheduled.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {unscheduled.length} item{unscheduled.length === 1 ? " has" : "s have"} no start date — set one in “List &
            edit”.
          </p>
        )}
      </TabsContent>
      <TabsContent value="list" className="mt-4">
        <EntityManager
          table="roadmap_items"
          noun="roadmap item"
          rows={items}
          fields={fields}
          revalidate="/roadmap"
          searchKeys={["title", "description"]}
          onRowClick={(i) => router.push(`/roadmap/${i.id}`)}
          columns={[
            { header: "Title", cell: (i) => <span className="font-medium">{i.title}</span> },
            { header: "Lane", cell: (i) => <Badge variant="outline">{labelize(i.lane)}</Badge> },
            {
              header: "Status",
              cell: (i) => (
                <Badge variant={i.status === "in_progress" ? "default" : "secondary"}>{labelize(i.status)}</Badge>
              ),
            },
            {
              header: "Dates",
              className: "hidden md:table-cell",
              cell: (i) => `${formatDate(i.start_date)} → ${formatDate(i.end_date)}`,
            },
            { header: "Idea", className: "hidden lg:table-cell", cell: (i) => i.idea?.title ?? "—" },
          ]}
        />
      </TabsContent>
    </Tabs>
  )
}
