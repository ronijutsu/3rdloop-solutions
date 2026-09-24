import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth"

import { ProjectList } from "./project-list"

export const metadata: Metadata = { title: "Projects" }

export default async function ProjectsPage() {
  const { supabase } = await requirePermission("planning.view")
  const [{ data: projects }, { data: ideas }, { data: founders }] = await Promise.all([
    supabase
      .from("projects")
      .select("*, idea:ideas(id, title), owner:profiles(full_name), tasks(status, archived_at), sprints(name, status)")
      .order("created_at", { ascending: false }),
    supabase.from("ideas").select("id, title").order("title"),
    supabase.from("profiles").select("id, full_name, email").in("role", ["founder", "admin"]),
  ])

  return (
    <>
      <PageHeader
        title="Projects"
        description="Agile delivery: sprints, backlog, boards, and burndown for every build."
      />
      <ProjectList projects={projects ?? []} ideas={ideas ?? []} founders={founders ?? []} />
    </>
  )
}
