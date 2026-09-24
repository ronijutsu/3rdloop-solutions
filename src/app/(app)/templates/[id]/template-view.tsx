"use client"

import { ArrowLeftIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useCallback, useState, useTransition } from "react"

import { DocEditor, type EditorSnapshot } from "@/components/editor/doc-editor"
import { SimpleSelect } from "@/components/simple-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TEMPLATE_CATEGORIES } from "@/lib/constants"
import type { Database } from "@/lib/supabase/database.types"

import { deleteTemplate, saveTemplate } from "../actions"

type Template = Database["public"]["Tables"]["document_templates"]["Row"]

export function TemplateView({ template, aiEnabled }: { template: Template; aiEnabled: boolean }) {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description ?? "")
  const [, startTransition] = useTransition()

  const onSave = useCallback(
    ({ html }: EditorSnapshot) =>
      saveTemplate(template.id, {
        name: name.trim() || "Untitled template",
        description: description.trim() || null,
        body_html: html,
      }),
    [template.id, name, description]
  )

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Button variant="ghost" size="icon" render={<Link href="/templates" />}>
          <ArrowLeftIcon />
          <span className="sr-only">Back to templates</span>
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 flex-1 border-transparent px-2 text-xl font-semibold shadow-none focus-visible:border-input"
          aria-label="Template name"
        />
        <SimpleSelect
          size="sm"
          className="w-40"
          options={TEMPLATE_CATEGORIES}
          defaultValue={template.category}
          onValueChange={(category) =>
            startTransition(async () => void (await saveTemplate(template.id, { category })))
          }
        />
        <Button variant="ghost" size="icon-sm" onClick={() => startTransition(() => deleteTemplate(template.id))}>
          <Trash2Icon />
          <span className="sr-only">Delete template</span>
        </Button>
      </div>
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() =>
          startTransition(
            async () => void (await saveTemplate(template.id, { description: description.trim() || null }))
          )
        }
        placeholder="Short description: when should the team use this template?"
        aria-label="Template description"
      />
      <p className="text-sm text-muted-foreground">
        Use placeholders like {"{{Company}}"} and {"{{Name}}"} for details the writer fills in.
      </p>
      <DocEditor initialContent={template.body_html} title={name} onSave={onSave} aiEnabled={aiEnabled} />
    </>
  )
}
