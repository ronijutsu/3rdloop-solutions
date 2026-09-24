"use client"

import { useRouter } from "next/navigation"

import { EntityManager, type FieldDef } from "@/components/entity-manager"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatDate, labelize, options } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"

type Project = Database["public"]["Tables"]["projects"]["Row"] & {
  idea: { id: string; title: string } | null
  owner: { full_name: string | null } | null
  tasks: { status: string; archived_at: string | null }[]
  sprints: { name: string; status: string }[]
}

export function ProjectList({
  projects,
  ideas,
  founders,
}: {
  projects: Project[]
  ideas: { id: string; title: string }[]
  founders: { id: string; full_name: string | null; email: string }[]
}) {
  const router = useRouter()
  const fields: FieldDef[] = [
    { name: "name", label: "Name", required: true, half: true },
    { name: "key", label: "Key", placeholder: "Auto, e.g. DENTAL", half: true },
    { name: "description", label: "Description", type: "textarea" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: options(["planning", "active", "on_hold", "done"] as const),
      required: true,
      half: true,
      defaultValue: "active",
    },
    {
      name: "owner_id",
      label: "Owner",
      type: "select",
      options: founders.map((f) => ({ value: f.id, label: f.full_name ?? f.email })),
      half: true,
    },
    { name: "start_date", label: "Start", type: "date", half: true },
    { name: "due_date", label: "Due", type: "date", half: true },
    {
      name: "idea_id",
      label: "Related idea",
      type: "select",
      options: ideas.map((i) => ({ value: i.id, label: i.title })),
    },
  ]

  return (
    <EntityManager
      table="projects"
      noun="project"
      rows={projects}
      fields={fields}
      revalidate="/projects"
      searchKeys={["name", "description"]}
      onRowClick={(p) => router.push(`/projects/${p.id}`)}
      columns={[
        {
          header: "Project",
          cell: (p) => (
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{p.key}</span>
              <span className="font-medium">{p.name}</span>
            </span>
          ),
        },
        {
          header: "Sprint",
          className: "hidden xl:table-cell",
          cell: (p) => p.sprints.find((s) => s.status === "active")?.name ?? "—",
        },
        {
          header: "Status",
          cell: (p) => <Badge variant={p.status === "active" ? "default" : "secondary"}>{labelize(p.status)}</Badge>,
        },
        {
          header: "Progress",
          className: "hidden md:table-cell w-48",
          cell: (p) => {
            const live = p.tasks.filter((t) => !t.archived_at)
            const done = live.filter((t) => t.status === "done").length
            return (
              <div className="flex items-center gap-2">
                <Progress
                  value={live.length ? (done / live.length) * 100 : 0}
                  className="flex-1"
                  aria-label="Task progress"
                />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {done}/{live.length}
                </span>
              </div>
            )
          },
        },
        { header: "Owner", className: "hidden lg:table-cell", cell: (p) => p.owner?.full_name ?? "—" },
        { header: "Due", cell: (p) => formatDate(p.due_date) },
      ]}
    />
  )
}
