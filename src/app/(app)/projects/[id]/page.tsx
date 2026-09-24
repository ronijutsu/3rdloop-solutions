import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { requirePermission } from "@/lib/auth"

import { ProjectView } from "./project-view"

export const metadata: Metadata = { title: "Project" }

const TABS = ["board", "backlog", "reports"] as const

export default async function ProjectPage({ params, searchParams }: PageProps<"/projects/[id]">) {
  const { id } = await params
  const { tab } = await searchParams
  const { supabase } = await requirePermission("planning.view")
  const [{ data: project }, { data: sprints }, { data: tasks }, { data: people }, { data: activity }] =
    await Promise.all([
      supabase.from("projects").select("*, idea:ideas(id, title), owner:profiles(full_name)").eq("id", id).single(),
      supabase
        .from("sprints")
        .select("*")
        .eq("project_id", id)
        .order("start_date", { nullsFirst: false })
        .order("created_at"),
      supabase
        .from("tasks")
        .select(
          "id, number, title, status, priority, kind, story_points, sprint_id, position, due_date, progress, created_at, started_at, completed_at, archived_at, assignees:task_assignees(profile_id), parent_id"
        )
        .eq("project_id", id)
        .order("position")
        .order("number"),
      supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .not("role", "in", "(disabled,pending,viewer)")
        .order("full_name"),
      // Status history for the flow charts.
      supabase
        .from("task_activity")
        .select("task_id, action, detail, created_at")
        .eq("project_id", id)
        .or("action.eq.created,and(action.eq.changed,detail->>field.eq.status)")
        .order("created_at")
        .limit(5000),
    ])
  if (!project) notFound()

  const current = TABS.find((t) => t === tab) ?? "board"
  // Boards, backlog, and charts work on top-level tasks; sub-tasks show as a count on their parent.
  const all = tasks ?? []
  const topLevel = all
    .filter((t) => !t.parent_id)
    .map((t) => ({
      ...t,
      subtasks: all.filter((c) => c.parent_id === t.id && !c.archived_at).map((c) => ({ done: c.status === "done" })),
    }))
  return (
    <ProjectView
      tab={current}
      project={project}
      sprints={sprints ?? []}
      tasks={topLevel}
      people={people ?? []}
      activity={activity ?? []}
    />
  )
}
