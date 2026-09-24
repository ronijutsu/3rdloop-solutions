import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth"

import { NetworkView } from "./network-view"

export const metadata: Metadata = { title: "Networking Hub" }

export default async function NetworkPage() {
  const { supabase } = await requirePermission("network.view")
  const { data: people } = await supabase
    .from("network_contacts")
    .select("*")
    .order("next_follow_up", { ascending: true, nullsFirst: false })

  return (
    <>
      <PageHeader
        title="Networking Hub"
        description="Investors, mentors, advisors, and partners — with follow-ups so no relationship goes cold."
      />
      <NetworkView people={people ?? []} today={new Date().toISOString().slice(0, 10)} />
    </>
  )
}
