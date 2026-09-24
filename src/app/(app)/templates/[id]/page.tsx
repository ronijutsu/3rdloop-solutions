import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { aiConfigured } from "@/lib/ai/client"
import { requirePermission } from "@/lib/auth"

import { TemplateView } from "./template-view"

export const metadata: Metadata = { title: "Edit template" }

export default async function TemplatePage({ params }: PageProps<"/templates/[id]">) {
  const { id } = await params
  const { supabase, can } = await requirePermission("templates.edit")
  const { data: template } = await supabase.from("document_templates").select("*").eq("id", id).single()
  if (!template) notFound()
  return <TemplateView template={template} aiEnabled={aiConfigured() && can("ai.use")} />
}
