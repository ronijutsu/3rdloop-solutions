"use client"

import type { Editor, JSONContent } from "@tiptap/react"
import { ArrowLeftIcon, LayoutTemplateIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useCallback, useRef, useState, useTransition } from "react"

import { DocEditor, type EditorSnapshot } from "@/components/editor/doc-editor"
import { SimpleSelect } from "@/components/simple-select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { TEMPLATE_CATEGORIES } from "@/lib/constants"
import type { Database, Json } from "@/lib/supabase/database.types"

import { deleteDocument, saveAsTemplate, saveDocument } from "../actions"

type Doc = Database["public"]["Tables"]["documents"]["Row"]

export function DocumentView({
  doc,
  ideas,
  aiEnabled,
  editable,
  canSaveTemplate,
}: {
  doc: Doc
  ideas: { id: string; title: string }[]
  aiEnabled: boolean
  editable: boolean
  canSaveTemplate: boolean
}) {
  const [title, setTitle] = useState(doc.title)
  const [pending, startTransition] = useTransition()
  const editorRef = useRef<Editor | null>(null)

  // Documents created from a template start as { html } until the first save.
  const stored = doc.content as { html?: string } & JSONContent
  const initial: JSONContent | string = typeof stored?.html === "string" ? stored.html : stored

  const onSave = useCallback(
    ({ json }: EditorSnapshot) => saveDocument(doc.id, { title: title.trim() || "Untitled", content: json as Json }),
    [doc.id, title]
  )

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Button variant="ghost" size="icon" render={<Link href="/documents" />}>
          <ArrowLeftIcon />
          <span className="sr-only">Back to documents</span>
        </Button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-10 flex-1 border-transparent px-2 text-xl font-semibold shadow-none focus-visible:border-input"
          aria-label="Document title"
          readOnly={!editable}
        />
        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <SimpleSelect
              size="sm"
              className="w-40"
              options={TEMPLATE_CATEGORIES}
              defaultValue={doc.category}
              placeholder="Category"
              onValueChange={(category) => startTransition(async () => void (await saveDocument(doc.id, { category })))}
            />
            <SimpleSelect
              size="sm"
              className="w-44"
              options={ideas.map((i) => ({ value: i.id, label: i.title }))}
              defaultValue={doc.idea_id}
              placeholder="Link to idea"
              allowEmpty
              onValueChange={(idea_id) =>
                startTransition(async () => void (await saveDocument(doc.id, { idea_id: idea_id || null })))
              }
            />
            {canSaveTemplate && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await saveAsTemplate(doc.id, editorRef.current?.getHTML() ?? "")
                    if (r.ok) toast.success("Saved as template")
                    else toast.error("Couldn't save template", { description: r.error })
                  })
                }
              >
                <LayoutTemplateIcon data-icon="inline-start" />
                Save as template
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                <Trash2Icon />
                <span className="sr-only">Delete document</span>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
                  <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => startTransition(() => deleteDocument(doc.id))}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
      <DocEditor
        initialContent={initial}
        title={title}
        onSave={onSave}
        aiEnabled={aiEnabled}
        editorRef={editorRef}
        editable={editable}
      />
    </>
  )
}
