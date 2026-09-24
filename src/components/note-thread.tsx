"use client"

import type { JSONContent } from "@tiptap/react"
import { Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { NoteComposer } from "@/components/editor/note-composer"
import { RichTextView } from "@/components/editor/rich-text-view"
import { PersonAvatar } from "@/components/people"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ActionResult } from "@/lib/actions/crud"
import type { Person } from "@/lib/agile"
import { formatDate, fromNow } from "@/lib/format"

export type ThreadNote = {
  id: string
  author_id: string
  body: unknown
  created_at: string
  author: Person | null
}

/** A card of posted rich-text notes with a composer. Authors can delete their own. */
export function NoteThread({
  me,
  notes,
  editable,
  title = "Notes",
  description,
  noun = "note",
  deleteHint,
  onPost,
  onDelete,
}: {
  me: string
  notes: ThreadNote[]
  editable: boolean
  title?: string
  description?: string
  noun?: string
  deleteHint?: string
  onPost: (json: JSONContent, html: string) => Promise<ActionResult>
  onDelete: (id: string) => Promise<ActionResult>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notes.length > 0 && (
          <ol className="flex flex-col gap-4">
            {notes.map((n) => (
              <li key={n.id} className="group flex gap-3">
                {n.author ? <PersonAvatar person={n.author} /> : <span className="size-6" />}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline gap-2 text-xs">
                    <span className="font-medium">{n.author?.full_name ?? n.author?.email ?? "Someone"}</span>
                    <time
                      suppressHydrationWarning
                      dateTime={n.created_at}
                      title={formatDate(n.created_at, "PPpp")}
                      className="text-muted-foreground"
                    >
                      {fromNow(n.created_at)}
                    </time>
                    {editable && n.author_id === me && (
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                            aria-label={`Delete ${noun}`}
                          >
                            <Trash2Icon />
                          </Button>
                        }
                        title={`Delete this ${noun}?`}
                        description={deleteHint}
                        onConfirm={async () => {
                          const r = await onDelete(n.id)
                          if (!r.ok) toast.error(`Couldn't delete ${noun}`, { description: r.error })
                          else toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} deleted`)
                        }}
                      />
                    )}
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <RichTextView content={n.body as JSONContent} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
        {editable ? (
          <NoteComposer
            placeholder={`Write ${noun === "update" ? "an update" : `a ${noun}`}…`}
            submitLabel={`Post ${noun}`}
            onPost={async ({ json, html }) => {
              const r = await onPost(json, html)
              if (!r.ok) {
                toast.error(`Couldn't post ${noun}`, { description: r.error })
                return false
              }
              toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} posted`)
              return true
            }}
          />
        ) : (
          !notes.length && <p className="text-sm text-muted-foreground">No {noun}s yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
