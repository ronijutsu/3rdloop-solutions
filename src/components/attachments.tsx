"use client"

import { DownloadIcon, EyeIcon, FileIcon, FileTextIcon, ImageIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ActionResult } from "@/lib/actions/crud"
import { formatDate, fromNow } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export type Attachment = {
  id: string
  name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
  url: string | null
  uploader: { full_name: string | null } | null
}
const MAX_BYTES = 50 * 1024 * 1024
const isImage = (a: Pick<Attachment, "mime_type" | "name">) =>
  (a.mime_type ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(a.name)
const isPdf = (a: Pick<Attachment, "mime_type" | "name">) => a.mime_type === "application/pdf" || /\.pdf$/i.test(a.name)

function formatSize(bytes: number | null) {
  if (!bytes) return "—"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

/**
 * Attachment list with drag-and-drop upload into the private project-files bucket. The browser uploads under
 * `prefix`, then `onRecord` saves the row server-side (and removes the file again if that fails).
 */
export function Attachments({
  prefix,
  attachments,
  editable,
  description = "Stored privately. Drop files here to attach.",
  onRecord,
  onRemove,
}: {
  prefix: string
  attachments: Attachment[]
  editable: boolean
  description?: string
  onRecord: (file: { name: string; path: string; mime: string | null; size: number }) => Promise<ActionResult>
  onRemove: (id: string) => Promise<ActionResult>
}) {
  const supabase = useMemo(() => createClient(), [])
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<Attachment | null>(null)

  async function upload(list: FileList | File[]) {
    const files = [...list]
    setUploading(files.length)
    let added = 0
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is too large`, { description: "Attachments must be 50 MB or smaller." })
        setUploading((n) => n - 1)
        continue
      }
      const path = `${prefix}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\- ]/g, "_")}`
      const { error } = await supabase.storage.from("project-files").upload(path, file, { contentType: file.type })
      if (error) toast.error(`Upload failed: ${file.name}`, { description: error.message })
      else {
        const r = await onRecord({ name: file.name, path, mime: file.type || null, size: file.size })
        if (!r.ok) toast.error(`Couldn't attach ${file.name}`, { description: r.error })
        else added++
      }
      setUploading((n) => n - 1)
    }
    setUploading(0)
    if (added) toast.success(added === 1 ? "File attached" : `${added} files attached`)
  }

  return (
    <Card
      onDragOver={(e) => {
        if (!editable) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!editable) return
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files.length) void upload(e.dataTransfer.files)
      }}
      className={cn("transition-colors", dragging && "border-primary bg-primary/5")}
    >
      <CardHeader>
        <CardTitle>Attachments</CardTitle>
        <CardDescription>{description}</CardDescription>
        {editable && (
          <CardAction>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) void upload(e.target.files)
                e.target.value = ""
              }}
            />
            <Button variant="outline" size="sm" disabled={uploading > 0} onClick={() => input.current?.click()}>
              <UploadIcon data-icon="inline-start" />
              {uploading > 0 ? `Uploading ${uploading}…` : "Attach files"}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {attachments.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {attachments.map((a) => {
              const Icon = isImage(a) ? ImageIcon : isPdf(a) ? FileTextIcon : FileIcon
              const previewable = a.url && (isImage(a) || isPdf(a))
              return (
                <li key={a.id} className="flex items-center gap-3 rounded-lg border p-2">
                  {isImage(a) && a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt="" className="size-10 shrink-0 rounded-md border object-cover" />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="size-5 text-muted-foreground" />
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium" title={a.name}>
                      {a.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
                      {formatSize(a.size_bytes)} · {a.uploader?.full_name ?? "Someone"} · {fromNow(a.created_at)}
                    </span>
                  </div>
                  {previewable && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Preview ${a.name}`}
                      onClick={() => setPreview(a)}
                    >
                      <EyeIcon />
                    </Button>
                  )}
                  {a.url && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Download ${a.name}`}
                      render={<a href={`${a.url}&download=${encodeURIComponent(a.name)}`} />}
                    >
                      <DownloadIcon />
                    </Button>
                  )}
                  {editable && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${a.name}`}>
                          <Trash2Icon />
                        </Button>
                      }
                      title={`Remove ${a.name}?`}
                      description="The file is deleted from storage."
                      confirmLabel="Remove"
                      onConfirm={async () => {
                        const r = await onRemove(a.id)
                        if (!r.ok) toast.error("Couldn't remove file", { description: r.error })
                        else toast.success("Attachment removed")
                      }}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            No attachments yet.
          </p>
        )}
      </CardContent>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="flex h-[85svh] flex-col gap-3 sm:max-w-4xl">
          <DialogHeader className="pr-8">
            <DialogTitle className="truncate">{preview?.name}</DialogTitle>
            <DialogDescription>
              {preview && `${formatSize(preview.size_bytes)} · added ${formatDate(preview.created_at)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-muted/50">
            {preview?.url &&
              (isImage(preview) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.name} className="max-h-full max-w-full object-contain" />
              ) : (
                <iframe src={preview.url} title={preview.name} className="size-full rounded-lg bg-white" />
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
