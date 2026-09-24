"use client"

import { ArrowLeftIcon, BarChart3Icon, KanbanIcon, ListTodoIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Person, Sprint } from "@/lib/agile"
import { formatDate, labelize } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"

import { Backlog } from "./backlog"
import { SprintBoard } from "./sprint-board"
import { Reports } from "./reports"

type Tables = Database["public"]["Tables"]
export type Project = Tables["projects"]["Row"] & {
  idea: { id: string; title: string } | null
  owner: { full_name: string | null } | null
}
export type ProjectTask = Pick<
  Tables["tasks"]["Row"],
  | "id"
  | "number"
  | "title"
  | "status"
  | "priority"
  | "kind"
  | "story_points"
  | "sprint_id"
  | "position"
  | "due_date"
  | "progress"
  | "created_at"
  | "started_at"
  | "completed_at"
  | "archived_at"
> & { assignees: { profile_id: string }[]; subtasks: { done: boolean }[] }
export type Activity = { task_id: string; action: string; detail: unknown; created_at: string }

export function ProjectView({
  tab,
  project,
  sprints,
  tasks,
  people,
  activity,
}: {
  tab: "board" | "backlog" | "reports"
  project: Project
  sprints: Sprint[]
  tasks: ProjectTask[]
  people: Person[]
  activity: Activity[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const live = tasks.filter((t) => !t.archived_at)
  const active = sprints.find((s) => s.status === "active") ?? null
  const done = live.filter((t) => t.status === "done").length

  return (
    <>
      <Button variant="ghost" size="sm" className="self-start" render={<Link href="/projects" />}>
        <ArrowLeftIcon data-icon="inline-start" />
        All projects
      </Button>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {project.key}
          </Badge>
          <Badge>{labelize(project.status)}</Badge>
          {project.idea && (
            <Badge variant="outline" render={<Link href={`/ideas/${project.idea.id}`} />}>
              {project.idea.title}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          {project.owner?.full_name ?? "No owner"} · {formatDate(project.start_date)} → {formatDate(project.due_date)} ·{" "}
          <span className="tabular-nums">
            {done}/{live.length} tasks done
          </span>
          {active && ` · ${active.name} running`}
        </p>
        {project.description && <p className="max-w-3xl text-sm">{project.description}</p>}
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => router.replace(`${pathname}?tab=${value}`, { scroll: false })}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="board">
            <KanbanIcon />
            Board
          </TabsTrigger>
          <TabsTrigger value="backlog">
            <ListTodoIcon />
            Backlog
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3Icon />
            Reports
          </TabsTrigger>
        </TabsList>
        <TabsContent value="board" className="flex flex-col gap-4">
          <SprintBoard project={project} sprint={active} sprints={sprints} tasks={live} people={people} />
        </TabsContent>
        <TabsContent value="backlog" className="flex flex-col gap-4">
          <Backlog project={project} sprints={sprints} tasks={tasks} people={people} />
        </TabsContent>
        <TabsContent value="reports" className="flex flex-col gap-4">
          <Reports project={project} sprints={sprints} tasks={live} people={people} activity={activity} />
        </TabsContent>
      </Tabs>
    </>
  )
}
