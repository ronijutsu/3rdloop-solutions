import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { aiConfigured } from "@/lib/ai/client"
import { jevConfigured } from "@/lib/ai/jev"
import { requirePermission } from "@/lib/auth"

import { DecisionView } from "./decision-view"

export const metadata: Metadata = { title: "Decision" }

export default async function DecisionPage({ params }: PageProps<"/decisions/[id]">) {
  const { id } = await params
  const { supabase, profile, can } = await requirePermission("decisions.view")

  const [{ data: decision }, { data: founders }] = await Promise.all([
    supabase
      .from("decisions")
      .select("*, idea:ideas(id, title), author:profiles!decisions_created_by_fkey(full_name), decision_votes(*)")
      .eq("id", id)
      .single(),
    supabase.rpc("voting_members"),
  ])
  if (!decision) notFound()

  return (
    <DecisionView
      decision={decision}
      founders={founders ?? []}
      me={profile.id}
      canVote={can("decisions.vote")}
      canManage={can("decisions.create")}
      canAskJev={(jevConfigured() || aiConfigured()) && can("ai.use")}
      jevReady={jevConfigured()}
    />
  )
}
