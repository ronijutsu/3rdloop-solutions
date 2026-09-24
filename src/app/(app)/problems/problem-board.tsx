"use client"

import { LightbulbIcon } from "lucide-react"
import Link from "next/link"

import { EntityManager, type FieldDef } from "@/components/entity-manager"
import { useCan } from "@/components/permissions-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { labelize, options } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"

import { ProblemSource } from "./problem-source"

type Problem = Database["public"]["Tables"]["problems"]["Row"] & {
  idea: { id: string; title: string } | null
  score: number
  screenshot_url: string | null
}

const FIELDS: FieldDef[] = [
  { name: "title", label: "Problem", required: true, placeholder: "Clinics lose 20% of new-patient calls after hours" },
  { name: "description", label: "What did you observe?", type: "textarea" },
  { name: "who_has_it", label: "Who has it?", placeholder: "Front-desk managers at 3–10 location dental groups" },
  { name: "evidence", label: "Evidence (quote)", type: "textarea", placeholder: "Paste what the person actually said" },
  {
    name: "source_type",
    label: "Source",
    type: "select",
    options: options(["interview", "reddit", "forum", "review", "social", "observation", "other"] as const),
    half: true,
  },
  { name: "source_url", label: "Source link", type: "url", half: true },
  { name: "frequency", label: "How often it happens", type: "rating", half: true },
  { name: "severity", label: "How painful", type: "rating", half: true },
  { name: "willingness_to_pay", label: "Willingness to pay", type: "rating", half: true },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: options(["spotted", "validating", "promoted", "dismissed"] as const),
    half: true,
    defaultValue: "spotted",
  },
]

export function ProblemBoard({ problems }: { problems: Problem[] }) {
  const can = useCan()
  return (
    <EntityManager
      table="problems"
      noun="problem"
      rows={problems}
      fields={FIELDS}
      revalidate="/problems"
      searchKeys={["title", "description", "who_has_it"]}
      emptyText="Every good idea starts as someone else's problem. Log the first one you've seen."
      columns={[
        {
          header: "Score",
          className: "w-20",
          cell: (p) => (
            <Badge
              variant={p.score >= 60 ? "default" : p.score >= 27 ? "secondary" : "outline"}
              title="Frequency × severity × willingness to pay (max 125)"
            >
              {p.score || "—"}
            </Badge>
          ),
        },
        {
          header: "Problem",
          cell: (p) => (
            <div className="flex max-w-md flex-col gap-0.5">
              <span className="font-medium">{p.title}</span>
              {p.who_has_it && <span className="truncate text-xs text-muted-foreground">{p.who_has_it}</span>}
              {p.evidence && (
                <blockquote className="mt-1 line-clamp-2 border-l-2 pl-2 text-xs text-muted-foreground italic">
                  “{p.evidence}”
                </blockquote>
              )}
              {p.source_url && (
                <ProblemSource
                  problemId={p.id}
                  url={p.source_url}
                  title={p.source_title}
                  evidence={p.evidence}
                  screenshotUrl={p.screenshot_url}
                  screenshotTakenAt={p.screenshot_taken_at}
                  editable={can("problems.edit")}
                />
              )}
            </div>
          ),
        },
        { header: "Source", className: "hidden md:table-cell", cell: (p) => labelize(p.source_type) },
        { header: "Status", cell: (p) => <Badge variant="outline">{labelize(p.status)}</Badge> },
        {
          header: "Idea",
          cell: (p) =>
            p.idea ? (
              <Link
                href={`/ideas/${p.idea.id}`}
                className="text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {p.idea.title}
              </Link>
            ) : !can("ideas.edit") ? (
              "—"
            ) : (
              <Button
                variant="outline"
                size="xs"
                render={<Link href={`/ideas/new?problem=${p.id}`} />}
                onClick={(e) => e.stopPropagation()}
              >
                <LightbulbIcon data-icon="inline-start" />
                Promote
              </Button>
            ),
        },
      ]}
    />
  )
}
