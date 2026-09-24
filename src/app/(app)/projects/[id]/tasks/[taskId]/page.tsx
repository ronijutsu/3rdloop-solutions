import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { taskCode } from "@/lib/agile"
import { requirePermission } from "@/lib/auth"

import { TaskDetail } from "./task-detail"

export async function generateMetadata({ params }: PageProps<"/projects/[id]/tasks/[taskId]">): Promise<Metadata> {
  const { taskId } = await params
  const { supabase } = await requirePermission("planning.view")
  const { data } = await supabase.from("tasks").select("title, number, project:projects(key)").eq("id", taskId).single()
  return { title: data ? `${taskCode(data.project?.key ?? "", data.number)} · ${data.title}` : "Task" }
}

export default async function TaskPage({ params }: PageProps<"/projects/[id]/tasks/[taskId]">) {
  const { id, taskId } = await params
  const { supabase, profile } = await requirePermission("planning.view")
  const [{ data: task }, { data: people }, { data: sprints }, { data: activity }, { data: children }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "*, project:projects(id, name, key), creator:profiles!tasks_created_by_fkey(full_name, email), assignees:task_assignees(profile_id), notes:task_notes(*, author:profiles(id, full_name, email, avatar_url)), attachments:task_attachments(*, uploader:profiles(full_name))"
        )
        .eq("id", taskId)
        .eq("project_id", id)
        .single(),
      supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .not("role", "in", "(disabled,pending,viewer)")
        .order("full_name"),
      supabase
        .from("sprints")
        .select("id, name, status")
        .eq("project_id", id)
        .neq("status", "completed")
        .order("created_at"),
      supabase
        .from("task_activity")
        .select("id, action, detail, created_at, actor:profiles(full_name, email)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("tasks")
        .select(
          "id, number, title, status, priority, kind, story_points, due_date, archived_at, assignees:task_assignees(profile_id)"
        )
        .eq("parent_id", taskId)
        .order("position")
        .order("number"),
    ])
  if (!task || !task.project) notFound()

  // Attachments live in a private bucket: sign them for this view (previews + downloads).
  const paths = task.attachments.map((a) => a.storage_path)
  const { data: signed } = paths.length
    ? await supabase.storage.from("project-files").createSignedUrls(paths, 3600)
    : { data: [] }
  const urls = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl]] : [])))

  const { data: parent } = task.parent_id
    ? await supabase.from("tasks").select("id, number, title").eq("id", task.parent_id).single()
    : { data: null }

  // The current sprint name is shown even when that sprint is completed (and so not in the picker).
  const { data: currentSprint } = task.sprint_id
    ? await supabase.from("sprints").select("id, name, status").eq("id", task.sprint_id).single()
    : { data: null }

  return (
    <TaskDetail
      me={profile.id}
      task={{
        ...task,
        project: task.project,
        parent,
        subtasks: (children ?? []).filter((c) => !c.archived_at),
        notes: [...task.notes].sort((a, b) => a.created_at.localeCompare(b.created_at)),
        attachments: task.attachments
          .map((a) => ({ ...a, url: urls.get(a.storage_path) ?? null }))
          .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      }}
      people={people ?? []}
      sprints={[...(currentSprint && currentSprint.status === "completed" ? [currentSprint] : []), ...(sprints ?? [])]}
      activity={activity ?? []}
    />
  )
}
