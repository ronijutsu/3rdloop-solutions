import { FilePlusIcon, PencilIcon, PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { requirePermission } from "@/lib/auth"
import { TEMPLATE_CATEGORIES, categoryLabel } from "@/lib/constants"

import { createDocument } from "../documents/actions"
import { createTemplate } from "./actions"

export const metadata: Metadata = { title: "Templates" }

export default async function TemplatesPage() {
  const { supabase, can } = await requirePermission("documents.view")
  const { data: templates } = await supabase.from("document_templates").select("*").order("name")

  const groups = TEMPLATE_CATEGORIES.map((c) => ({
    ...c,
    items: (templates ?? []).filter((t) => t.category === c.value),
  })).filter((g) => g.items.length > 0)

  return (
    <>
      <PageHeader
        title="Templates"
        description="Reusable starting points for internal work: B2B and B2C scripts, lead-gen sequences, proposals, SOPs."
        actions={
          can("templates.edit") && (
            <form action={createTemplate}>
              <Button type="submit">
                <PlusIcon data-icon="inline-start" />
                New template
              </Button>
            </form>
          )
        }
      />
      {groups.map((group) => (
        <section key={group.value} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{group.label}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.items.map((t) => (
              <Card key={t.id}>
                <CardHeader>
                  <Badge variant="secondary" className="self-start">
                    {categoryLabel(t.category)}
                  </Badge>
                  <CardTitle className="mt-2">{t.name}</CardTitle>
                  {t.description && <CardDescription className="line-clamp-3">{t.description}</CardDescription>}
                </CardHeader>
                <CardFooter className="mt-auto gap-2">
                  {can("documents.edit") && (
                    <form action={createDocument.bind(null, t.id, null)}>
                      <Button type="submit" size="sm">
                        <FilePlusIcon data-icon="inline-start" />
                        Use template
                      </Button>
                    </form>
                  )}
                  {can("templates.edit") && (
                    <Button variant="outline" size="sm" render={<Link href={`/templates/${t.id}`} />}>
                      <PencilIcon data-icon="inline-start" />
                      Edit
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
