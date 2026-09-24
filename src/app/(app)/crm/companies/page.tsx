import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { requirePermission } from "@/lib/auth"

import { CompaniesContacts } from "./companies-contacts"

export const metadata: Metadata = { title: "Companies & Contacts" }

export default async function CompaniesPage({ searchParams }: PageProps<"/crm/companies">) {
  const { supabase } = await requirePermission("crm.view")
  const { tab } = await searchParams
  const [{ data: companies }, { data: contacts }] = await Promise.all([
    supabase.from("companies").select("*, deals(value)").order("name"),
    supabase.from("contacts").select("*, company:companies(id, name)").order("full_name"),
  ])

  return (
    <>
      <PageHeader title="Companies & Contacts" description="Everyone you sell to, in one place." />
      <CompaniesContacts
        tab={tab === "contacts" ? "contacts" : "companies"}
        companies={companies ?? []}
        contacts={contacts ?? []}
      />
    </>
  )
}
