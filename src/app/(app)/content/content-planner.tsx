"use client"

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

import { EntityManager, type FieldDef } from "@/components/entity-manager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate, labelize, options } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

type Item = Database["public"]["Tables"]["content_items"]["Row"] & { owner: { full_name: string | null } | null }

const CHANNELS = ["linkedin", "x", "blog", "newsletter", "youtube", "podcast", "other"] as const
const STATUSES = ["idea", "drafting", "review", "scheduled", "published"] as const

export function ContentPlanner({
  items,
  founders,
}: {
  items: Item[]
  founders: { id: string; full_name: string | null; email: string }[]
}) {
  const [tab, setTab] = useState("calendar")
  const requested = useSearchParams().get("new") === "content_items"
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const fields: FieldDef[] = [
    { name: "title", label: "Title / hook", required: true },
    {
      name: "channel",
      label: "Channel",
      type: "select",
      options: options(CHANNELS),
      required: true,
      half: true,
      defaultValue: "linkedin",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: options(STATUSES),
      required: true,
      half: true,
      defaultValue: "idea",
    },
    { name: "publish_date", label: "Publish date", type: "date", half: true },
    {
      name: "owner_id",
      label: "Owner",
      type: "select",
      options: founders.map((f) => ({ value: f.id, label: f.full_name ?? f.email })),
      half: true,
    },
    { name: "body", label: "Draft", type: "textarea" },
    { name: "url", label: "Published URL", type: "url" },
  ]

  const days = eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) })

  return (
    <Tabs value={requested ? "list" : tab} onValueChange={(v) => setTab(v as string)}>
      <TabsList>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
        <TabsTrigger value="list">Pipeline</TabsTrigger>
      </TabsList>
      <TabsContent value="calendar" className="mt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeftIcon />
            <span className="sr-only">Previous month</span>
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRightIcon />
            <span className="sr-only">Next month</span>
          </Button>
          <h2 className="font-medium">{format(month, "MMMM yyyy")}</h2>
          <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Today
          </Button>
        </div>
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="grid min-w-[48rem] grid-cols-7 overflow-hidden rounded-xl border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="border-b bg-muted/40 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd")
              const dayItems = items.filter((i) => i.publish_date === key)
              return (
                <div
                  key={key}
                  className={cn(
                    "flex min-h-24 flex-col gap-1 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
                    !isSameMonth(day, month) && "bg-muted/30"
                  )}
                >
                  <span className={cn("text-xs text-muted-foreground", isToday(day) && "font-semibold text-primary")}>
                    {format(day, "d")}
                  </span>
                  {dayItems.map((item) => (
                    <div
                      key={item.id}
                      title={`${item.title} · ${labelize(item.channel)} · ${labelize(item.status)}`}
                      className={cn(
                        "truncate rounded border bg-card px-1.5 py-0.5 text-xs",
                        item.status === "published" && "text-muted-foreground"
                      )}
                    >
                      <span className="font-medium">{labelize(item.channel)}:</span> {item.title}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </TabsContent>
      <TabsContent value="list" className="mt-4">
        <EntityManager
          table="content_items"
          noun="content item"
          rows={items}
          fields={fields}
          revalidate="/content"
          searchKeys={["title", "body"]}
          wide
          columns={[
            { header: "Title", cell: (i) => <span className="font-medium">{i.title}</span> },
            { header: "Channel", cell: (i) => <Badge variant="outline">{labelize(i.channel)}</Badge> },
            {
              header: "Status",
              cell: (i) => (
                <Badge variant={i.status === "published" ? "default" : "secondary"}>{labelize(i.status)}</Badge>
              ),
            },
            { header: "Publish", cell: (i) => formatDate(i.publish_date) },
            { header: "Owner", className: "hidden md:table-cell", cell: (i) => i.owner?.full_name ?? "—" },
          ]}
        />
      </TabsContent>
    </Tabs>
  )
}
