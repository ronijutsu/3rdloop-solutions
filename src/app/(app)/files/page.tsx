import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth"

import { FileExplorer } from "./file-explorer"

export const metadata: Metadata = { title: "Files" }

export default async function FilesPage({ searchParams }: PageProps<"/files">) {
  const { supabase } = await requirePermission("files.view")
  const { folder } = await searchParams
  const [{ data: folders }, { data: files }, { data: ideas }] = await Promise.all([
    supabase.from("file_folders").select("*").order("name"),
    supabase
      .from("uploads")
      .select("*, uploader:profiles(full_name), idea:ideas(id, title)")
      .order("created_at", { ascending: false }),
    supabase.from("ideas").select("id, title").order("title"),
  ])

  return (
    <>
      <PageHeader
        title="Files"
        description="Contracts, decks, research, and recordings, organised in folders. Stored privately; only your team can open them."
      />
      <FileExplorer
        folders={folders ?? []}
        files={files ?? []}
        ideas={ideas ?? []}
        currentFolderId={typeof folder === "string" ? folder : null}
      />
    </>
  )
}
