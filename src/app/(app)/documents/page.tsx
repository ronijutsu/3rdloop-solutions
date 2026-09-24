import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requirePermission } from "@/lib/auth"
import { categoryLabel } from "@/lib/constants"
import { fromNow } from "@/lib/format"

export const metadata: Metadata = { title: "Documents" }

export default async function DocumentsPage() {
  const { supabase, can } = await requirePermission("documents.view")
  const { data: docs } = await supabase
    .from("documents")
    .select(
      "id, title, category, updated_at, idea:ideas(id, title), editor:profiles!documents_updated_by_fkey(full_name)"
    )
    .order("updated_at", { ascending: false })

  return (
    <>
      <PageHeader
        title="Documents"
        description="Write with Tiptap, draft with AI, export to Word or PDF."
        actions={
          can("documents.edit") && (
            <Button render={<Link href="/documents/new" />}>
              <PlusIcon data-icon="inline-start" />
              New document
            </Button>
          )
        }
      />
      {!docs?.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No documents yet</EmptyTitle>
            <EmptyDescription>Start blank or from a template like a B2B script.</EmptyDescription>
          </EmptyHeader>
          {can("documents.edit") && (
            <EmptyContent>
              <Button render={<Link href="/documents/new" />}>New document</Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden md:table-cell">Idea</TableHead>
                <TableHead className="text-right">Last edited</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    <Link href={`/documents/${doc.id}`} className="hover:underline">
                      {doc.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{categoryLabel(doc.category)}</Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{doc.idea?.title ?? "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {fromNow(doc.updated_at)}
                    {doc.editor?.full_name && ` by ${doc.editor.full_name}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
