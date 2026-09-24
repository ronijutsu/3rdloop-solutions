import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { aiConfigured } from "@/lib/ai/client"
import { requirePermission } from "@/lib/auth"

import { DocumentView } from "./document-view"

export const metadata: Metadata = { title: "Document" }

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params
  const { supabase, can } = await requirePermission("documents.view")
  const [{ data: doc }, { data: ideas }] = await Promise.all([
    supabase.from("documents").select("*").eq("id", id).single(),
    supabase.from("ideas").select("id, title").order("title"),
  ])
  if (!doc) notFound()

  return (
    <DocumentView
      doc={doc}
      ideas={ideas ?? []}
      aiEnabled={aiConfigured() && can("ai.use")}
      editable={can("documents.edit")}
      canSaveTemplate={can("templates.edit")}
    />
  )
}
