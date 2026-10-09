"use client"

import { GraduationCapIcon, PlusIcon, SearchIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { createTask, quickTaskProjects } from "@/app/(app)/projects/actions"
import { NotificationBell } from "@/components/notification-bell"
import { useCan } from "@/components/permissions-provider"
import { SimpleSelect } from "@/components/simple-select"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import { INTERNSHIP_URL, NAV, QUICK_ADD, type QuickAddItem } from "@/lib/navigation"

/** Sticky top bar: sidebar toggle, jump-to palette (Ctrl/⌘ K), quick add, notifications, theme. */
export function AppTopbar() {
  const router = useRouter()
  const can = useCan()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const creatable = QUICK_ADD.filter((q) => can(q.permission))
  const groups = [...new Set(creatable.map((q) => q.group))]
  const pages = NAV.flatMap((g) => g.items).filter((i) => !i.permission || can(i.permission))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function create(item: QuickAddItem) {
    setPaletteOpen(false)
    if (item.href === "task") setTaskOpen(true)
    else router.push(item.href)
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur md:px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Button
        variant="outline"
        className="h-9 w-full max-w-72 min-w-0 shrink justify-start gap-2 px-3 font-normal text-muted-foreground"
        onClick={() => setPaletteOpen(true)}
        aria-label="Jump to a page or create something"
      >
        <SearchIcon data-icon="inline-start" />
        <span className="truncate">Jump to…</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          render={<a href={INTERNSHIP_URL} target="_blank" rel="noopener noreferrer" />}
          aria-label="Internship Program (opens in a new tab)"
        >
          <GraduationCapIcon data-icon="inline-start" />
          <span className="hidden md:inline">Internships</span>
        </Button>
        {creatable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" className="gap-1.5" />}>
              <PlusIcon data-icon="inline-start" />
              <span className="hidden sm:inline">New</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[70svh] w-56 overflow-y-auto">
              {groups.map((group, i) => (
                <DropdownMenuGroup key={group}>
                  {i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel>{group}</DropdownMenuLabel>
                  {creatable
                    .filter((q) => q.group === group)
                    .map((q) => (
                      <DropdownMenuItem key={q.title} onClick={() => create(q)}>
                        <q.icon />
                        {q.title}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <NotificationBell />
        <ThemeToggle />
      </div>

      <CommandDialog
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        title="Jump to"
        description="Go to a page or create something new"
      >
        <Command>
          <CommandInput placeholder="Go to a page or create something…" />
          <CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            {creatable.length > 0 && (
              <CommandGroup heading="Create">
                {creatable.map((q) => (
                  <CommandItem key={q.title} value={`new ${q.title}`} onSelect={() => create(q)}>
                    <q.icon />
                    New {q.title.toLowerCase()}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup heading="Go to">
              {pages.map((p) => (
                <CommandItem
                  key={p.href}
                  value={`go ${p.title}`}
                  onSelect={() => {
                    setPaletteOpen(false)
                    if (p.external) window.open(p.href, "_blank", "noopener,noreferrer")
                    else router.push(p.href)
                  }}
                >
                  <p.icon />
                  {p.title}
                  <CommandShortcut>{p.external ? new URL(p.href).host : p.href}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>

      <NewTaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
    </header>
  )
}

/** Create a task in any project without leaving the page, then open it. */
function NewTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const [projects, setProjects] = useState<{ id: string; name: string; key: string }[] | null>(null)
  const [projectId, setProjectId] = useState("")
  const [title, setTitle] = useState("")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || projects) return
    let live = true
    void quickTaskProjects().then((r) => {
      if (!live) return
      if (!r.ok) return void toast.error("Couldn't load projects", { description: r.error })
      setProjects(r.data ?? [])
      setProjectId((current) => current || r.data?.[0]?.id || "")
    })
    return () => {
      live = false
    }
  }, [open, projects])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            It lands in the project&apos;s backlog; you can plan it into a sprint later.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault()
            startTransition(async () => {
              const r = await createTask({ projectId, title })
              if (!r.ok) return void toast.error("Couldn't create task", { description: r.error })
              toast.success("Task created")
              onOpenChange(false)
              setTitle("")
              router.push(`/projects/${projectId}/tasks/${r.data?.id}`)
            })
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="quick-task-project">Project</FieldLabel>
              {projects === null ? (
                <Spinner />
              ) : projects.length ? (
                <SimpleSelect
                  id="quick-task-project"
                  value={projectId}
                  onValueChange={setProjectId}
                  options={projects.map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No active projects yet. Create a project first.</p>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="quick-task-title">Title</FieldLabel>
              <Input
                id="quick-task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs doing?"
                required
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending || !projectId || !title.trim()}>
              {pending && <Spinner data-icon="inline-start" />}
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
