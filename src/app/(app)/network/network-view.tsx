"use client"

import { EntityManager, type FieldDef } from "@/components/entity-manager"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RELATIONSHIPS } from "@/lib/constants"
import { formatDate, labelize } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"

type Person = Database["public"]["Tables"]["network_contacts"]["Row"]

const FIELDS: FieldDef[] = [
  { name: "full_name", label: "Name", required: true },
  { name: "organization", label: "Organization", half: true },
  { name: "role", label: "Role", half: true },
  {
    name: "relationship",
    label: "Relationship",
    type: "select",
    options: RELATIONSHIPS,
    required: true,
    half: true,
    defaultValue: "peer",
  },
  { name: "strength", label: "Relationship strength", type: "rating", half: true },
  { name: "email", label: "Email", type: "email", half: true },
  { name: "linkedin", label: "LinkedIn", type: "url", half: true },
  { name: "last_contacted", label: "Last contacted", type: "date", half: true },
  { name: "next_follow_up", label: "Next follow-up", type: "date", half: true },
  {
    name: "notes",
    label: "Notes",
    type: "textarea",
    placeholder: "How you met, what they care about, how they can help, how you can help them",
  },
]

export function NetworkView({ people, today }: { people: Person[]; today: string }) {
  const due = people.filter((p) => p.next_follow_up && p.next_follow_up <= today)

  return (
    <div className="flex flex-col gap-6">
      {due.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Follow-ups due</CardTitle>
            <CardDescription>
              {due.length} relationship{due.length === 1 ? "" : "s"} waiting on you.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {due.map((p) => (
              <Badge key={p.id} variant="outline" className="h-auto py-1">
                {p.full_name}
                {p.organization && ` · ${p.organization}`} · {formatDate(p.next_follow_up, "MMM d")}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
      <EntityManager
        table="network_contacts"
        noun="person"
        rows={people}
        fields={FIELDS}
        revalidate="/network"
        searchKeys={["full_name", "organization", "role", "notes"]}
        columns={[
          {
            header: "Name",
            cell: (p) => (
              <div className="flex flex-col">
                <span className="font-medium">{p.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  {[p.role, p.organization].filter(Boolean).join(" · ")}
                </span>
              </div>
            ),
          },
          { header: "Relationship", cell: (p) => <Badge variant="secondary">{labelize(p.relationship)}</Badge> },
          {
            header: "Strength",
            className: "hidden md:table-cell",
            cell: (p) => (p.strength ? "●".repeat(p.strength) + "○".repeat(5 - p.strength) : "—"),
          },
          { header: "Last contact", className: "hidden lg:table-cell", cell: (p) => formatDate(p.last_contacted) },
          {
            header: "Follow up",
            cell: (p) =>
              p.next_follow_up ? (
                <Badge variant={p.next_follow_up <= today ? "destructive" : "outline"}>
                  {formatDate(p.next_follow_up, "MMM d")}
                </Badge>
              ) : (
                "—"
              ),
          },
        ]}
      />
    </div>
  )
}
