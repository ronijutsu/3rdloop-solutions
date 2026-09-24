"use client"

import { Placeholder } from "@tiptap/extension-placeholder"
import { TableKit } from "@tiptap/extension-table"
import { TextAlign } from "@tiptap/extension-text-align"
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react"
import { StarterKit } from "@tiptap/starter-kit"
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  CheckIcon,
  DownloadIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  Redo2Icon,
  SparklesIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
  Undo2Icon,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useRef, useState, useTransition, type ReactNode, type RefObject } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { draftWithAI } from "@/lib/actions/ai-draft"
import type { DocNode } from "@/lib/export/types"
import { cn } from "@/lib/utils"

export type EditorSnapshot = { json: JSONContent; html: string }

const QUICK_PROMPTS = [
  "B2B discovery call script for a logistics company exploring AI document processing",
  "B2C sales script for a solo professional buying an AI assistant subscription",
  "3-email cold outreach sequence for agencies drowning in manual reporting",
  "One-page pilot proposal with scope, timeline, success metric, and price",
  "Competitor matrix table: pricing, target customer, strengths, common complaints",
]

export function DocEditor({
  initialContent,
  title,
  onSave,
  aiEnabled,
  placeholder = "Start writing, or use AI Draft…",
  headerSlot,
  editorRef,
  editable = true,
  compact = false,
  exportable = true,
}: {
  /** Tiptap JSON, or an HTML string (templates, AI output). */
  initialContent: JSONContent | string
  title: string
  onSave: (snapshot: EditorSnapshot) => Promise<{ ok: boolean; error?: string }>
  aiEnabled: boolean
  placeholder?: string
  headerSlot?: ReactNode
  /** Receives the editor instance, e.g. to read its HTML on demand. */
  editorRef?: RefObject<Editor | null>
  /** Read-only when false: no toolbar, AI, or saving; export still works. */
  editable?: boolean
  /** Shorter canvas for bodies embedded in another page (e.g. a task). */
  compact?: boolean
  exportable?: boolean
}) {
  const [status, setStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved")
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      TableKit.configure({ table: { resizable: false } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: compact ? "prose-doc min-h-48 px-4 py-4 md:px-6" : "prose-doc min-h-[60svh] px-6 py-8 md:px-12",
      },
    },
    onUpdate: () => {
      setStatus("dirty")
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void save(), 1200)
    },
  })

  useEffect(() => {
    if (editorRef) editorRef.current = editor
  }, [editor, editorRef])

  async function save() {
    if (!editor) return
    setStatus("saving")
    const result = await onSaveRef.current({ json: editor.getJSON(), html: editor.getHTML() })
    setStatus(result.ok ? "saved" : "error")
    if (!result.ok) toast.error("Couldn't save", { description: result.error })
  }

  // Save when the title changes too.
  const firstTitle = useRef(true)
  useEffect(() => {
    if (firstTitle.current) {
      firstTitle.current = false
      return
    }
    setStatus("dirty")
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(), 1200)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b bg-card/95 p-2 backdrop-blur">
        {headerSlot}
        {editor && editable && <Toolbar editor={editor} />}
        {!editable && <span className="px-2 text-xs text-muted-foreground">Read-only</span>}
        <div className="ml-auto flex items-center gap-2">
          {editable && <SaveStatus status={status} />}
          {editor && editable && aiEnabled && <AIDraftButton editor={editor} title={title} aiEnabled={aiEnabled} />}
          {editor && exportable && <ExportMenu editor={editor} title={title} />}
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function SaveStatus({ status }: { status: "saved" | "dirty" | "saving" | "error" }) {
  const text = { saved: "Saved", dirty: "Unsaved", saving: "Saving…", error: "Save failed" }[status]
  return (
    <span
      className={cn("flex items-center gap-1 text-xs text-muted-foreground", status === "error" && "text-destructive")}
    >
      {status === "saving" ? <Spinner /> : status === "saved" ? <CheckIcon className="size-3.5" /> : null}
      {text}
    </span>
  )
}

export function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      left: e.isActive({ textAlign: "left" }),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const chain = () => editor.chain().focus()

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <Tool icon={Undo2Icon} label="Undo" disabled={!state.canUndo} onClick={() => chain().undo().run()} />
      <Tool icon={Redo2Icon} label="Redo" disabled={!state.canRedo} onClick={() => chain().redo().run()} />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Tool
        icon={Heading1Icon}
        label="Heading 1"
        active={state.h1}
        onClick={() => chain().toggleHeading({ level: 1 }).run()}
      />
      <Tool
        icon={Heading2Icon}
        label="Heading 2"
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <Tool
        icon={Heading3Icon}
        label="Heading 3"
        active={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Tool icon={BoldIcon} label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()} />
      <Tool icon={ItalicIcon} label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()} />
      <Tool
        icon={UnderlineIcon}
        label="Underline"
        active={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      />
      <Tool
        icon={StrikethroughIcon}
        label="Strikethrough"
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      <LinkTool editor={editor} active={state.link} />
      <Separator orientation="vertical" className="mx-1 h-5" />
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
      <Tool icon={QuoteIcon} label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()} />
      <Tool icon={MinusIcon} label="Divider" onClick={() => chain().setHorizontalRule().run()} />
      <Tool
        icon={TableIcon}
        label="Insert table"
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Tool
        icon={AlignLeftIcon}
        label="Align left"
        active={state.left}
        onClick={() => chain().setTextAlign("left").run()}
      />
      <Tool
        icon={AlignCenterIcon}
        label="Align center"
        active={state.center}
        onClick={() => chain().setTextAlign("center").run()}
      />
      <Tool
        icon={AlignRightIcon}
        label="Align right"
        active={state.right}
        onClick={() => chain().setTextAlign("right").run()}
      />
    </div>
  )
}

export function LinkTool({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")

  function apply(href: string) {
    const chain = editor.chain().focus().extendMarkRange("link")
    if (href.trim()) chain.setLink({ href: href.trim() }).run()
    else chain.unsetLink().run()
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setUrl((editor.getAttributes("link").href as string | undefined) ?? "https://")
        setOpen(next)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon-sm"
            aria-pressed={active}
            title="Link"
          />
        }
      >
        <LinkIcon />
        <span className="sr-only">Link</span>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            apply(url)
          }}
        >
          <Field>
            <FieldLabel htmlFor="link-url">Link URL</FieldLabel>
            <Input id="link-url" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            {active && (
              <Button type="button" variant="ghost" size="sm" onClick={() => apply("")}>
                Remove link
              </Button>
            )}
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

export function Tool({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon />
    </Button>
  )
}

function ExportMenu({ editor, title }: { editor: Editor; title: string }) {
  const [busy, setBusy] = useState(false)

  async function run(kind: "docx" | "pdf") {
    setBusy(true)
    try {
      const doc = editor.getJSON() as DocNode
      if (kind === "docx") await (await import("@/lib/export/docx")).exportDocx(title, doc)
      else await (await import("@/lib/export/pdf")).exportPdf(title, doc)
    } catch (error) {
      toast.error("Export failed", { description: String(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={busy} />}>
        {busy ? <Spinner data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => run("docx")}>Word document (.docx)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("pdf")}>PDF (.pdf)</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AIDraftButton({ editor, title, aiEnabled }: { editor: Editor; title: string; aiEnabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [instructions, setInstructions] = useState("")
  const [mode, setMode] = useState<"replace" | "append">(editor.isEmpty ? "replace" : "append")
  const [pending, startTransition] = useTransition()

  function generate() {
    startTransition(async () => {
      const result = await draftWithAI({ title, instructions, currentHtml: editor.getHTML(), mode })
      if (!result.ok) {
        toast.error("AI draft failed", { description: result.error })
        return
      }
      const html = result.data!.html
      if (mode === "replace") editor.chain().focus().setContent(html, { emitUpdate: true }).run()
      else editor.chain().focus("end").insertContent(html).run()
      toast.success("Draft inserted", { description: "Review it carefully before sharing." })
      setOpen(false)
      setInstructions("")
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <SparklesIcon data-icon="inline-start" />
        AI Draft
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Draft with AI</DialogTitle>
            <DialogDescription>
              {aiEnabled
                ? "AI writes a draft using the current document as context. A human edits before anything goes out."
                : "Set OPENROUTER_API_KEY in .env.local to enable AI drafting."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ai-instructions">What should it write?</FieldLabel>
              <Textarea
                id="ai-instructions"
                rows={4}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. A discovery call script for mid-size accounting firms struggling with client onboarding paperwork"
              />
              <FieldDescription className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_PROMPTS.map((p) => (
                  <Button key={p} type="button" variant="outline" size="xs" onClick={() => setInstructions(p)}>
                    {p.split(" ").slice(0, 4).join(" ")}…
                  </Button>
                ))}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Insert</FieldLabel>
              <ToggleGroup
                value={[mode]}
                onValueChange={(v) => v[0] && setMode(v[0] as typeof mode)}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="append">Add to end</ToggleGroupItem>
                <ToggleGroupItem value="replace">Replace document</ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!aiEnabled || pending || !instructions.trim()} onClick={generate}>
              {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
              {pending ? "Drafting…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
