"use client"

import { useRouter } from "next/navigation"

import { EntityManager, type FieldDef } from "@/components/entity-manager"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SEGMENTS, segmentLabel } from "@/lib/constants"
import { formatMoney } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"

type Company = Database["public"]["Tables"]["companies"]["Row"] & { deals: { value: number }[] }
type Contact = Database["public"]["Tables"]["contacts"]["Row"] & { company: { id: string; name: string } | null }

const COMPANY_FIELDS: FieldDef[] = [
  { name: "name", label: "Name", required: true },
  { name: "website", label: "Website", type: "url", half: true },
  { name: "industry", label: "Industry", half: true },
  { name: "segment", label: "Segment", type: "select", options: SEGMENTS, half: true },
  { name: "size", label: "Size", half: true, placeholder: "e.g. 11–50" },
  { name: "location", label: "Location" },
  { name: "notes", label: "Notes", type: "textarea" },
]

export function CompaniesContacts({
  tab,
  companies,
  contacts,
}: {
  tab: "companies" | "contacts"
  companies: Company[]
  contacts: Contact[]
}) {
  const router = useRouter()
  const contactFields: FieldDef[] = [
    { name: "full_name", label: "Full name", required: true },
    { name: "title", label: "Job title", half: true },
    {
      name: "company_id",
      label: "Company",
      type: "select",
      options: companies.map((c) => ({ value: c.id, label: c.name })),
      half: true,
    },
    { name: "email", label: "Email", type: "email", half: true },
    { name: "phone", label: "Phone", half: true },
    { name: "linkedin", label: "LinkedIn", type: "url" },
    { name: "notes", label: "Notes", type: "textarea" },
  ]

  return (
    <Tabs value={tab} onValueChange={(v) => router.replace(`/crm/companies?tab=${v}`)}>
      <TabsList>
        <TabsTrigger value="companies">Companies ({companies.length})</TabsTrigger>
        <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="companies" className="mt-4">
        <EntityManager
          table="companies"
          noun="company"
          rows={companies}
          fields={COMPANY_FIELDS}
          revalidate="/crm/companies"
          searchKeys={["name", "industry", "location"]}
          columns={[
            { header: "Company", cell: (c) => <span className="font-medium">{c.name}</span> },
            {
              header: "Segment",
              cell: (c) => (c.segment ? <Badge variant="secondary">{segmentLabel(c.segment)}</Badge> : "—"),
            },
            { header: "Industry", cell: (c) => c.industry ?? "—", className: "hidden md:table-cell" },
            {
              header: "Website",
              className: "hidden lg:table-cell",
              cell: (c) =>
                c.website ? (
                  <a
                    href={c.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  "—"
                ),
            },
            {
              header: "Pipeline value",
              className: "text-right",
              cell: (c) => formatMoney(c.deals.reduce((s, d) => s + Number(d.value), 0)),
            },
          ]}
        />
      </TabsContent>
      <TabsContent value="contacts" className="mt-4">
        <EntityManager
          table="contacts"
          noun="contact"
          rows={contacts}
          fields={contactFields}
          revalidate="/crm/companies"
          searchKeys={["full_name", "email", "title"]}
          columns={[
            { header: "Name", cell: (c) => <span className="font-medium">{c.full_name}</span> },
            { header: "Title", cell: (c) => c.title ?? "—", className: "hidden whitespace-normal lg:table-cell" },
            { header: "Company", cell: (c) => c.company?.name ?? "—" },
            {
              header: "Email",
              className: "hidden whitespace-nowrap xl:table-cell",
              cell: (c) =>
                c.email ? (
                  <a href={`mailto:${c.email}`} className="text-primary hover:underline">
                    {c.email}
                  </a>
                ) : (
                  "—"
                ),
            },
            { header: "Phone", cell: (c) => c.phone ?? "—", className: "hidden whitespace-nowrap xl:table-cell" },
          ]}
        />
      </TabsContent>
    </Tabs>
  )
}
