"use client"

import { EditorContent, useEditor, type JSONContent } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"

import { cn } from "@/lib/utils"

/**
 * Read-only rendering of stored Tiptap JSON. Going through the editor schema (instead of injecting saved HTML)
 * means only known nodes and marks render, so a crafted note can't smuggle in script.
 */
export function RichTextView({ content, className }: { content: JSONContent; className?: string }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [StarterKit.configure({ link: { openOnClick: true } })],
    content,
    editorProps: { attributes: { class: cn("prose-doc text-sm", className) } },
  })
  return <EditorContent editor={editor} />
}
