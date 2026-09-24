import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { requirePermission } from "@/lib/auth"

import { RoadmapItem, type LinkCandidate } from "./roadmap-item"

export async function generateMetadata({ params }: PageProps<"/roadmap/[id]">): Promise<Metadata> {
  const { id } = await params
  const { supabase } = await requirePermission("planning.view")
  const { data } = await supabase.from("roadmap_items").select("title").eq("id", id).single()
  return { title: data?.title ?? "Roadmap item" }
}

export default async function RoadmapItemPage({ params }: PageProps<"/roadmap/[id]">) {
  const { id } = await params
  const { supabase, profile } = await requirePermission("planning.view")
  const [
    { data: item },
    { data: people },
    { data: projects },
    { data: ideas },
    { data: decisions },
    { data: documents },
    { data: objectives },
    { data: files },
    { data: deals },
  ] = await Promise.all([
    supabase
      .from("roadmap_items")
      .select(
        "*, owner:profiles!roadmap_items_owner_id_fkey(id, full_name, email, avatar_url), creator:profiles!roadmap_items_created_by_fkey(full_name, email), milestones:roadmap_milestones(*), links:roadmap_links(*), attachments:roadmap_attachments(*, uploader:profiles(full_name)), updates:roadmap_updates(*, author:profiles(id, full_name, email, avatar_url))"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .not("role", "in", "(disabled,pending,viewer)")
      .order("full_name"),
    // Things a roadmap item can link to. Each is readable only with its module's permission (RLS), so a
    // missing module simply yields no candidates.
    supabase.from("projects").select("id, name, key").order("name"),
    supabase.from("ideas").select("id, title").order("title"),
    supabase.from("decisions").select("id, title").order("created_at", { ascending: false }).limit(200),
    supabase.from("documents").select("id, title").order("updated_at", { ascending: false }).limit(200),
    supabase.from("objectives").select("id, title").order("created_at", { ascending: false }),
    supabase.from("uploads").select("id, name, folder_id").order("created_at", { ascending: false }).limit(300),
    supabase.from("deals").select("id, title").order("created_at", { ascending: false }).limit(200),
  ])
  if (!item) notFound()

  const candidates: LinkCandidate[] = [
    ...(projects ?? []).map((p) => ({ kind: "project" as const, id: p.id, label: `${p.key} · ${p.name}` })),
    ...(ideas ?? []).map((i) => ({ kind: "idea" as const, id: i.id, label: i.title })),
    ...(decisions ?? []).map((d) => ({ kind: "decision" as const, id: d.id, label: d.title })),
    ...(documents ?? []).map((d) => ({ kind: "document" as const, id: d.id, label: d.title })),
    ...(objectives ?? []).map((o) => ({ kind: "objective" as const, id: o.id, label: o.title })),
    ...(files ?? []).map((f) => ({ kind: "file" as const, id: f.id, label: f.name, folder: f.folder_id })),
    ...(deals ?? []).map((d) => ({ kind: "deal" as const, id: d.id, label: d.title })),
  ]

  const paths = item.attachments.map((a) => a.storage_path)
  const { data: signed } = paths.length
    ? await supabase.storage.from("project-files").createSignedUrls(paths, 3600)
    : { data: [] }
  const urls = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl]] : [])))

  return (
    <RoadmapItem
      me={profile.id}
      item={{
        ...item,
        milestones: [...item.milestones].sort(
          (a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.position - b.position
        ),
        links: [...item.links].sort((a, b) => a.created_at.localeCompare(b.created_at)),
        updates: [...item.updates].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        attachments: item.attachments
          .map((a) => ({ ...a, url: urls.get(a.storage_path) ?? null }))
          .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      }}
      people={people ?? []}
      ideas={(ideas ?? []).map((i) => ({ value: i.id, label: i.title }))}
      candidates={candidates}
    />
  )
}
