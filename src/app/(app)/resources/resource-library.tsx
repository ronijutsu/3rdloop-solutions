"use client"

import { ExternalLinkIcon } from "lucide-react"
import { useState } from "react"

import { EntityManager, type FieldDef } from "@/components/entity-manager"
import { Badge } from "@/components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { labelize, options } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"

type Resource = Database["public"]["Tables"]["resources"]["Row"] & { author: { full_name: string | null } | null }

const CATEGORIES = ["playbook", "tool", "article", "course", "template", "legal", "finance", "other"] as const

const FIELDS: FieldDef[] = [
  { name: "title", label: "Title", required: true },
  { name: "url", label: "Link", type: "url" },
  {
    name: "category",
    label: "Category",
    type: "select",
    options: options(CATEGORIES),
    required: true,
    defaultValue: "article",
  },
  { name: "description", label: "Why it's useful", type: "textarea" },
]

export function ResourceLibrary({ resources }: { resources: Resource[] }) {
  const [category, setCategory] = useState("all")
  const visible = category === "all" ? resources : resources.filter((r) => r.category === category)

  return (
    <EntityManager
      table="resources"
      noun="resource"
      rows={visible}
      fields={FIELDS}
      revalidate="/resources"
      searchKeys={["title", "description", "url"]}
      toolbar={
        <ToggleGroup
          value={[category]}
          onValueChange={(v) => v[0] && setCategory(v[0])}
          variant="outline"
          size="sm"
          className="flex-wrap"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          {CATEGORIES.map((c) => (
            <ToggleGroupItem key={c} value={c}>
              {labelize(c)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
      columns={[
        {
          header: "Resource",
          cell: (r) => (
            <div className="flex max-w-xl flex-col gap-0.5">
              {r.url ? (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {r.title}
                  <ExternalLinkIcon className="size-3" />
                </a>
              ) : (
                <span className="font-medium">{r.title}</span>
              )}
              {r.description && <span className="line-clamp-2 text-xs text-muted-foreground">{r.description}</span>}
            </div>
          ),
        },
        { header: "Category", cell: (r) => <Badge variant="secondary">{labelize(r.category)}</Badge> },
        { header: "Added by", className: "hidden md:table-cell", cell: (r) => r.author?.full_name ?? "—" },
      ]}
    />
  )
}
