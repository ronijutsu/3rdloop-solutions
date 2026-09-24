"use client"

import { Placeholder } from "@tiptap/extension-placeholder"
import { EditorContent, useEditor, useEditorState, type JSONContent } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"
import { BoldIcon, ItalicIcon, ListIcon, ListOrderedIcon, SendIcon } from "lucide-react"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

import { LinkTool, Tool } from "./doc-editor"

/** A small rich-text box that posts once (notes, comments) instead of autosaving. */
export function NoteComposer({
  onPost,
  placeholder = "Write a note…",
  submitLabel = "Post note",
}: {
  onPost: (note: { json: JSONContent; html: string }) => Promise<boolean>
  placeholder?: string
  submitLabel?: string
}) {
  const [pending, startTransition] = useTransition()
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false, link: { openOnClick: false, autolink: true } }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: {
      attributes: { class: "prose-doc min-h-20 px-3 py-2 text-sm", "aria-label": placeholder },
    },
  })
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            link: e.isActive("link"),
            empty: e.isEmpty,
          }
        : null,
  })

  function post() {
    if (!editor || editor.isEmpty) return
    const note = { json: editor.getJSON(), html: editor.getHTML() }
    startTransition(async () => {
      if (await onPost(note)) editor.commands.clearContent(true)
    })
  }

  const chain = () => editor!.chain().focus()
  return (
    <div
      className="flex flex-col rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring/40"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          post()
        }
      }}
    >
      <EditorContent editor={editor} />
      <div className="flex items-center gap-0.5 border-t px-1.5 py-1">
        {editor && state && (
          <>
            <Tool icon={BoldIcon} label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()} />
            <Tool icon={ItalicIcon} label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()} />
            <Tool
              icon={ListIcon}
              label="Bullet list"
              active={state.bullet}
              onClick={() => chain().toggleBulletList().run()}
            />
            <Tool
              icon={ListOrderedIcon}
              label="Numbered list"
              active={state.ordered}
              onClick={() => chain().toggleOrderedList().run()}
            />
            <LinkTool editor={editor} active={state.link} />
          </>
        )}
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">Ctrl + Enter</span>
        <Button size="sm" className="ml-2" disabled={pending || !state || state.empty} onClick={post}>
          {pending ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
