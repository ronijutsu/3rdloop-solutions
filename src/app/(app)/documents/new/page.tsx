import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth"

import { TemplatePicker } from "./template-picker"

export const metadata: Metadata = { title: "New document" }

export default async function NewDocumentPage({ searchParams }: PageProps<"/documents/new">) {
  const { supabase } = await requirePermission("documents.edit")
  const { idea } = await searchParams
  const ideaId = typeof idea === "string" ? idea : null
  const { data: templates } = await supabase
    .from("document_templates")
    .select("id, name, category, description")
    .order("category")

  return (
    <>
      <PageHeader title="New document" description="Start from a blank page or one of your team's templates." />
      <TemplatePicker templates={templates ?? []} ideaId={ideaId} />
    </>
  )
}
