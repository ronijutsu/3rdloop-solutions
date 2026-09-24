"use client"

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  EyeIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  FolderInputIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  HomeIcon,
  ImageIcon,
  LayoutGridIcon,
  ListIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Fragment, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { useCan } from "@/components/permissions-provider"
import { SimpleSelect } from "@/components/simple-select"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatDate } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

type Folder = Database["public"]["Tables"]["file_folders"]["Row"]
type Upload = Database["public"]["Tables"]["uploads"]["Row"] & {
  uploader: { full_name: string | null } | null
  idea: { id: string; title: string } | null
}

const MAX_BYTES = 50 * 1024 * 1024
const ROOT = "Files"

const isImage = (f: Upload) =>
  (f.mime_type ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(f.name)
const isPdf = (f: Upload) => f.mime_type === "application/pdf" || /\.pdf$/i.test(f.name)
const canPreview = (f: Upload) => isImage(f) || isPdf(f)

function formatSize(bytes: number | null) {
  if (!bytes) return "—"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}

function FileGlyph({ file, className }: { file: Upload; className?: string }) {
  const Icon = isImage(file) ? ImageIcon : isPdf(file) ? FileTextIcon : FileIcon
  return <Icon className={cn("shrink-0 text-muted-foreground", className)} />
}

export function FileExplorer({
  folders,
  files,
  ideas,
  currentFolderId,
}: {
  folders: Folder[]
  files: Upload[]
  ideas: { id: string; title: string }[]
  currentFolderId: string | null
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const editable = useCan()("files.edit")
  const [, startTransition] = useTransition()
  const refresh = () => startTransition(() => router.refresh())

  const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders])
  const current = currentFolderId ? (byId.get(currentFolderId) ?? null) : null
  const folderId = current?.id ?? null

  const childrenOf = (id: string | null) => folders.filter((f) => f.parent_id === id)
  // Breadcrumb trail from the root down to the open folder.
  const path: Folder[] = []
  for (let f = current; f; f = f.parent_id ? (byId.get(f.parent_id) ?? null) : null) path.unshift(f)

  const [query, setQuery] = useState("")
  const [view, setView] = useState<"grid" | "list">("grid")
  const searching = query.trim().length > 0
  const subfolders = searching ? [] : childrenOf(folderId)
  const visibleFiles = searching
    ? files.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()))
    : files.filter((f) => f.folder_id === folderId)

  // Thumbnails for images in view (private bucket, so signed URLs).
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const imagePaths = visibleFiles.filter(isImage).map((f) => f.storage_path)
  const thumbKey = imagePaths.join("|")
  useEffect(() => {
    const missing = thumbKey.split("|").filter((p) => p && !thumbs[p])
    if (!missing.length) return
    void supabase.storage
      .from("documents")
      .createSignedUrls(missing, 3600)
      .then(({ data }) => {
        if (!data) return
        setThumbs((t) => ({
          ...t,
          ...Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : []))),
        }))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbKey, supabase])

  const folderHref = (id: string | null) => (id ? `/files?folder=${id}` : "/files")
  const countIn = (id: string) => files.filter((f) => f.folder_id === id).length + childrenOf(id).length

  // --- Uploads ---
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [dragging, setDragging] = useState(false)

  async function upload(list: FileList | File[]) {
    const items = [...list]
    setUploading(items.length)
    for (const file of items) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is too large`, { description: "Files must be 50 MB or smaller." })
        continue
      }
      const path = `${crypto.randomUUID()}/${file.name.replace(/[^\w.\- ]/g, "_")}`
      const { error: storageError } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: file.type })
      if (storageError) {
        toast.error(`Upload failed: ${file.name}`, { description: storageError.message })
        continue
      }
      const { error } = await supabase.from("uploads").insert({
        name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        folder_id: folderId,
      })
      if (error) {
        await supabase.storage.from("documents").remove([path])
        toast.error(`Couldn't save ${file.name}`, { description: error.message })
      }
      setUploading((n) => n - 1)
    }
    setUploading(0)
    refresh()
  }

  async function download(file: Upload) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(file.storage_path, 60, { download: file.name })
    if (error || !data) {
      toast.error("Couldn't create download link", { description: error?.message })
      return
    }
    window.location.assign(data.signedUrl)
  }

  async function remove(file: Upload) {
    await supabase.storage.from("documents").remove([file.storage_path])
    const { error } = await supabase.from("uploads").delete().eq("id", file.id)
    if (error) toast.error("Couldn't delete", { description: error.message })
    else toast.success(`${file.name} deleted`)
    refresh()
  }

  // --- Dialogs ---
  const [folderDialog, setFolderDialog] = useState<{ mode: "create" } | { mode: "rename"; folder: Folder } | null>(null)
  const [moving, setMoving] = useState<Upload | null>(null)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const previewable = visibleFiles.filter(canPreview)

  async function deleteFolder(folder: Folder) {
    if (countIn(folder.id) > 0) {
      toast.error("Folder isn't empty", { description: "Move or delete what's inside it first." })
      return
    }
    const { error } = await supabase.from("file_folders").delete().eq("id", folder.id)
    if (error) {
      toast.error("Couldn't delete folder", { description: error.message })
      return
    }
    toast.success(`Deleted ${folder.name}`)
    if (folder.id === folderId) router.push(folderHref(folder.parent_id))
    else refresh()
  }

  function openFile(file: Upload) {
    if (canPreview(file)) setPreviewIndex(previewable.findIndex((f) => f.id === file.id))
    else void download(file)
  }

  const fileMenu = (file: Upload) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" onClick={(e) => e.stopPropagation()} />}>
        <MoreHorizontalIcon />
        <span className="sr-only">Actions for {file.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuGroup>
          {canPreview(file) && (
            <DropdownMenuItem onClick={() => openFile(file)}>
              <EyeIcon />
              Preview
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => download(file)}>
            <DownloadIcon />
            Download
          </DropdownMenuItem>
          {editable && (
            <DropdownMenuItem onClick={() => setMoving(file)}>
              <FolderInputIcon />
              Move or link…
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        {editable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <ConfirmDialog
                title={`Delete ${file.name}?`}
                description="The file is removed from storage for everyone."
                onConfirm={() => remove(file)}
                trigger={
                  <DropdownMenuItem variant="destructive" closeOnClick={false}>
                    <Trash2Icon />
                    Delete
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="grid min-h-[32rem] overflow-hidden rounded-xl border bg-card md:grid-cols-[15rem_1fr]">
      {/* Sidebar */}
      <aside className="hidden flex-col gap-1 border-r bg-muted/30 p-2 md:flex">
        <SidebarLink href="/files" active={!folderId && !searching} icon={HomeIcon} label={ROOT} />
        <nav aria-label="Folders" className="flex flex-col">
          <FolderTree
            parentId={null}
            depth={0}
            childrenOf={childrenOf}
            activeId={folderId}
            openPath={new Set(path.map((f) => f.id))}
            href={folderHref}
          />
        </nav>
        {editable && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-auto justify-start"
            onClick={() => setFolderDialog({ mode: "create" })}
          >
            <FolderPlusIcon data-icon="inline-start" />
            New folder
          </Button>
        )}
      </aside>

      {/* Main */}
      <section
        className="relative flex min-w-0 flex-col"
        onDragOver={(e) => {
          if (!editable || !e.dataTransfer.types.includes("Files")) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
        }}
        onDrop={(e) => {
          if (!editable) return
          e.preventDefault()
          setDragging(false)
          if (e.dataTransfer.files.length) void upload(e.dataTransfer.files)
        }}
      >
        <header className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="md:hidden">
              <SimpleSelect
                size="sm"
                className="w-40"
                options={[{ value: "root", label: ROOT }, ...flatten(null, 0, childrenOf)]}
                value={folderId ?? "root"}
                onValueChange={(v) => router.push(folderHref(v === "root" ? null : v))}
              />
            </div>
            <Breadcrumb className="hidden min-w-0 md:block">
              <BreadcrumbList>
                <BreadcrumbItem>
                  {path.length === 0 && !searching ? (
                    <BreadcrumbPage>{ROOT}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href="/files" />}>{ROOT}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {searching ? (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Search results</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                ) : (
                  path.map((f, i) => (
                    <Fragment key={f.id}>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {i === path.length - 1 ? (
                          <BreadcrumbPage className="truncate">{f.name}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink render={<Link href={folderHref(f.id)} />}>{f.name}</BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  ))
                )}
              </BreadcrumbList>
            </Breadcrumb>
            {current && editable && !searching && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                  <MoreHorizontalIcon />
                  <span className="sr-only">Folder actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => setFolderDialog({ mode: "rename", folder: current })}>
                      <PencilIcon />
                      Rename folder
                    </DropdownMenuItem>
                    <ConfirmDialog
                      title={`Delete “${current.name}”?`}
                      description="Only empty folders can be deleted."
                      onConfirm={() => deleteFolder(current)}
                      trigger={
                        <DropdownMenuItem variant="destructive" closeOnClick={false}>
                          <Trash2Icon />
                          Delete folder
                        </DropdownMenuItem>
                      }
                    />
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="w-full sm:w-56">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search all files"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </InputGroup>
            <ToggleGroup
              value={[view]}
              onValueChange={(v) => v[0] && setView(v[0] as typeof view)}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="grid" aria-label="Grid view">
                <LayoutGridIcon />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view">
                <ListIcon />
              </ToggleGroupItem>
            </ToggleGroup>
            {editable && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setFolderDialog({ mode: "create" })}
                >
                  <FolderPlusIcon data-icon="inline-start" />
                  Folder
                </Button>
                <input
                  ref={input}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => e.target.files && upload(e.target.files)}
                />
                <Button size="sm" onClick={() => input.current?.click()} disabled={uploading > 0}>
                  {uploading ? <Spinner data-icon="inline-start" /> : <UploadIcon data-icon="inline-start" />}
                  {uploading ? `Uploading ${uploading}…` : "Upload"}
                </Button>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 p-4">
          {subfolders.length === 0 && visibleFiles.length === 0 ? (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">{searching ? <SearchIcon /> : <FolderOpenIcon />}</EmptyMedia>
                <EmptyTitle>{searching ? "No matching files" : "This folder is empty"}</EmptyTitle>
                <EmptyDescription>
                  {searching
                    ? "Try another name."
                    : editable
                      ? "Drop files here, upload them, or create a folder."
                      : "Nothing has been uploaded here yet."}
                </EmptyDescription>
              </EmptyHeader>
              {!searching && editable && (
                <EmptyContent className="flex-row justify-center">
                  <Button variant="outline" size="sm" onClick={() => setFolderDialog({ mode: "create" })}>
                    <FolderPlusIcon data-icon="inline-start" />
                    New folder
                  </Button>
                  <Button size="sm" onClick={() => input.current?.click()}>
                    <UploadIcon data-icon="inline-start" />
                    Upload files
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : view === "grid" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
              {subfolders.map((f) => (
                <Link
                  key={f.id}
                  href={folderHref(f.id)}
                  className="group flex flex-col gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <FolderIcon className="size-8 fill-primary/15 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {countIn(f.id)} item{countIn(f.id) === 1 ? "" : "s"}
                    </p>
                  </div>
                </Link>
              ))}
              {visibleFiles.map((file) => (
                <div
                  key={file.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openFile(file)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openFile(file))}
                  className="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="flex aspect-[4/3] items-center justify-center bg-muted/50">
                    {isImage(file) && thumbs[file.storage_path] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed URLs from private storage
                      <img src={thumbs[file.storage_path]} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <FileGlyph file={file} className="size-10" />
                    )}
                  </div>
                  <div className="flex items-start gap-1 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatSize(file.size_bytes)} · {formatDate(file.created_at, "MMM d")}
                      </p>
                    </div>
                    <div className="-mr-1 opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                      {fileMenu(file)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden lg:table-cell">Linked idea</TableHead>
                  <TableHead className="hidden sm:table-cell">Size</TableHead>
                  <TableHead className="hidden md:table-cell">Added</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subfolders.map((f) => (
                  <TableRow key={f.id} className="cursor-pointer" onClick={() => router.push(folderHref(f.id))}>
                    <TableCell>
                      <Link href={folderHref(f.id)} className="flex items-center gap-2 font-medium">
                        <FolderIcon className="size-4 fill-primary/15 text-primary" />
                        {f.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell" />
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {countIn(f.id)} item{countIn(f.id) === 1 ? "" : "s"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDate(f.created_at)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))}
                {visibleFiles.map((file) => (
                  <TableRow key={file.id} className="cursor-pointer" onClick={() => openFile(file)}>
                    <TableCell>
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        <FileGlyph file={file} className="size-4" />
                        <span className="truncate">{file.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {file.idea?.title ?? "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatSize(file.size_bytes)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDate(file.created_at)} · {file.uploader?.full_name ?? "—"}
                    </TableCell>
                    <TableCell>{fileMenu(file)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {dragging && (
          <div className="pointer-events-none absolute inset-2 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-background/90 text-sm">
            <UploadIcon className="size-6 text-primary" />
            <span className="font-medium">Drop to upload to {current?.name ?? ROOT}</span>
          </div>
        )}
      </section>

      <FolderDialog
        state={folderDialog}
        parentId={folderId}
        parentName={current?.name ?? ROOT}
        onClose={() => setFolderDialog(null)}
        onSaved={(id) => {
          setFolderDialog(null)
          if (id) router.push(folderHref(id))
          else refresh()
        }}
      />

      <MoveDialog
        file={moving}
        folders={folders}
        childrenOf={childrenOf}
        ideas={ideas}
        onClose={() => setMoving(null)}
        onSaved={() => {
          setMoving(null)
          refresh()
        }}
      />

      <PreviewDialog files={previewable} index={previewIndex} onIndex={setPreviewIndex} onDownload={download} />
    </div>
  )
}

function SidebarLink({
  href,
  active,
  icon: Icon,
  label,
  depth = 0,
  trailing,
}: {
  href: string
  active: boolean
  icon: typeof FolderIcon
  label: string
  depth?: number
  trailing?: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={{ paddingLeft: `${0.5 + depth * 0.875}rem` }}
      className={cn(
        "flex h-8 items-center gap-2 rounded-md pr-2 text-sm transition-colors hover:bg-muted",
        active && "bg-primary/10 font-medium text-primary hover:bg-primary/10"
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      <span className="truncate">{label}</span>
      {trailing}
    </Link>
  )
}

function FolderTree({
  parentId,
  depth,
  childrenOf,
  activeId,
  openPath,
  href,
}: {
  parentId: string | null
  depth: number
  childrenOf: (id: string | null) => Folder[]
  activeId: string | null
  openPath: Set<string>
  href: (id: string | null) => string
}) {
  return childrenOf(parentId).map((folder) => {
    const expanded = openPath.has(folder.id)
    const hasChildren = childrenOf(folder.id).length > 0
    return (
      <div key={folder.id} className="flex flex-col">
        <SidebarLink
          href={href(folder.id)}
          active={folder.id === activeId}
          icon={expanded ? FolderOpenIcon : FolderIcon}
          label={folder.name}
          depth={depth + 1}
          trailing={
            hasChildren && (
              <ChevronRightIcon
                className={cn("ml-auto size-3.5 text-muted-foreground transition-transform", expanded && "rotate-90")}
              />
            )
          }
        />
        {expanded && (
          <FolderTree
            parentId={folder.id}
            depth={depth + 1}
            childrenOf={childrenOf}
            activeId={activeId}
            openPath={openPath}
            href={href}
          />
        )}
      </div>
    )
  })
}

/** Folder tree flattened into indented select options. */
function flatten(parentId: string | null, depth: number, childrenOf: (id: string | null) => Folder[]) {
  const out: { value: string; label: string }[] = []
  for (const f of childrenOf(parentId)) {
    out.push({ value: f.id, label: `${" ".repeat(depth)}${f.name}` })
    out.push(...flatten(f.id, depth + 1, childrenOf))
  }
  return out
}

function FolderDialog({
  state,
  parentId,
  parentName,
  onClose,
  onSaved,
}: {
  state: { mode: "create" } | { mode: "rename"; folder: Folder } | null
  parentId: string | null
  parentName: string
  onClose: () => void
  onSaved: (newFolderId: string | null) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [pending, startTransition] = useTransition()
  const renaming = state?.mode === "rename" ? state.folder : null

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{renaming ? "Rename folder" : "New folder"}</DialogTitle>
          <DialogDescription>{renaming ? renaming.name : `Inside ${parentName}`}</DialogDescription>
        </DialogHeader>
        <form
          key={renaming?.id ?? "new"}
          className="flex flex-col gap-6"
          action={(fd) =>
            startTransition(async () => {
              const name = String(fd.get("name") ?? "").trim()
              if (!name) return
              const { data, error } = renaming
                ? await supabase.from("file_folders").update({ name }).eq("id", renaming.id).select("id").single()
                : await supabase.from("file_folders").insert({ name, parent_id: parentId }).select("id").single()
              if (error) {
                toast.error("Couldn't save folder", {
                  description: error.code === "23505" ? "A folder with that name already exists here." : error.message,
                })
                return
              }
              toast.success(renaming ? "Folder renamed" : `Created ${name}`)
              onSaved(renaming ? null : data.id)
            })
          }
        >
          <Field>
            <FieldLabel htmlFor="folder-name">Name</FieldLabel>
            <Input
              id="folder-name"
              name="name"
              defaultValue={renaming?.name ?? ""}
              placeholder="Contracts"
              maxLength={80}
              required
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {renaming ? "Rename" : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MoveDialog({
  file,
  childrenOf,
  ideas,
  onClose,
  onSaved,
}: {
  file: Upload | null
  folders: Folder[]
  childrenOf: (id: string | null) => Folder[]
  ideas: { id: string; title: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={file !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move or link</DialogTitle>
          <DialogDescription className="truncate">{file?.name}</DialogDescription>
        </DialogHeader>
        <form
          key={file?.id}
          className="flex flex-col gap-6"
          action={(fd) =>
            startTransition(async () => {
              const folder = String(fd.get("folder_id") ?? "root")
              const idea = String(fd.get("idea_id") ?? "")
              const { error } = await supabase
                .from("uploads")
                .update({ folder_id: folder === "root" ? null : folder, idea_id: idea || null })
                .eq("id", file!.id)
              if (error) {
                toast.error("Couldn't update file", { description: error.message })
                return
              }
              toast.success("File updated")
              onSaved()
            })
          }
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="move-folder">Folder</FieldLabel>
              <SimpleSelect
                id="move-folder"
                name="folder_id"
                options={[{ value: "root", label: ROOT }, ...flatten(null, 0, childrenOf)]}
                defaultValue={file?.folder_id ?? "root"}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="move-idea">Linked idea</FieldLabel>
              <SimpleSelect
                id="move-idea"
                name="idea_id"
                options={ideas.map((i) => ({ value: i.id, label: i.title }))}
                defaultValue={file?.idea_id}
                allowEmpty
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PreviewDialog({
  files,
  index,
  onIndex,
  onDownload,
}: {
  files: Upload[]
  index: number | null
  onIndex: (index: number | null) => void
  onDownload: (file: Upload) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const file = index !== null ? files[index] : undefined
  const [urls, setUrls] = useState<Record<string, string>>({})
  const url = file ? urls[file.id] : undefined

  useEffect(() => {
    if (!file || urls[file.id]) return
    void supabase.storage
      .from("documents")
      .createSignedUrl(file.storage_path, 600)
      .then(({ data, error }) => {
        if (error || !data) toast.error("Couldn't open preview", { description: error?.message })
        else setUrls((u) => ({ ...u, [file.id]: data.signedUrl }))
      })
  }, [file, urls, supabase])

  const step = (delta: number) => {
    if (index === null || files.length < 2) return
    onIndex((index + delta + files.length) % files.length)
  }

  return (
    <Dialog open={file !== undefined} onOpenChange={(o) => !o && onIndex(null)}>
      <DialogContent
        className="flex h-[90svh] flex-col gap-3 sm:max-w-5xl"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1)
          if (e.key === "ArrowLeft") step(-1)
        }}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate">{file?.name}</DialogTitle>
          <DialogDescription>
            {file && `${formatSize(file.size_bytes)} · added ${formatDate(file.created_at)}`}
            {files.length > 1 && index !== null && ` · ${index + 1} of ${files.length}`}
          </DialogDescription>
        </DialogHeader>
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-muted/50">
          {!url ? (
            <Spinner className="size-6" />
          ) : file && isImage(file) ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage
            <img src={url} alt={file.name} className="max-h-full max-w-full object-contain" />
          ) : (
            <iframe src={url} title={file?.name} className="size-full border-0 bg-white" />
          )}
        </div>
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <div className="flex gap-1">
            <Button variant="outline" size="icon" disabled={files.length < 2} onClick={() => step(-1)}>
              <ChevronLeftIcon />
              <span className="sr-only">Previous file</span>
            </Button>
            <Button variant="outline" size="icon" disabled={files.length < 2} onClick={() => step(1)}>
              <ChevronRightIcon />
              <span className="sr-only">Next file</span>
            </Button>
          </div>
          {file && (
            <Button onClick={() => onDownload(file)}>
              <DownloadIcon data-icon="inline-start" />
              Download
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
