"use client"

import { MoreHorizontalIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
import { useMemo, useState, useTransition, type ReactNode } from "react"

import { useCan } from "@/components/permissions-provider"
import { SimpleSelect, type Option } from "@/components/simple-select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useNewParam } from "@/hooks/use-new-param"
import { toast } from "sonner"
import { deleteRow, saveRow } from "@/lib/actions/crud"
import { TABLE_EDIT_PERMISSION } from "@/lib/permissions"
import type { Database } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

type Table = keyof Database["public"]["Tables"]
type Row = { id: string } & Record<string, unknown>

export type FieldDef = {
  name: string
  label: string
  type?: "text" | "textarea" | "number" | "date" | "url" | "email" | "select" | "rating" | "tags"
  options?: Option[]
  required?: boolean
  placeholder?: string
  /** Render at half width next to another half field. */
  half?: boolean
  defaultValue?: string
}

export type ColumnDef<R> = {
  header: string
  cell: (row: R) => ReactNode
  className?: string
}

const RATING_OPTIONS: Option[] = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} / 5` }))

export function EntityManager<R extends Row>({
  table,
  rows,
  fields,
  columns,
  noun,
  revalidate,
  searchKeys = [],
  defaults = {},
  emptyText,
  toolbar,
  onRowClick,
  wide = false,
}: {
  table: Table
  rows: R[]
  fields: FieldDef[]
  columns: ColumnDef<R>[]
  noun: string
  revalidate: string
  searchKeys?: (keyof R & string)[]
  defaults?: Record<string, unknown>
  emptyText?: string
  toolbar?: ReactNode
  onRowClick?: (row: R) => void
  wide?: boolean
}) {
  const [query, setQuery] = useState("")
  const can = useCan()
  const editable = can(TABLE_EDIT_PERMISSION[table])
  const [editingState, setEditingState] = useState<R | "new" | null>(null)
  // `?new=<table>` (quick add in the top bar) opens the create form.
  const [requested, clearRequest] = useNewParam(table)
  const editing = editingState ?? (requested && editable ? "new" : null)
  const setEditing = (value: R | "new" | null) => {
    setEditingState(value)
    if (value === null) clearRequest()
  }
  const [deleting, setDeleting] = useState<R | null>(null)
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      searchKeys.some((key) =>
        String(row[key] ?? "")
          .toLowerCase()
          .includes(q)
      )
    )
  }, [rows, query, searchKeys])

  function submit(formData: FormData) {
    const values: Record<string, unknown> = { ...(editing === "new" ? defaults : {}) }
    for (const field of fields) {
      const raw = formData.get(field.name)
      const text = typeof raw === "string" ? raw.trim() : ""
      if (field.type === "number" || field.type === "rating") values[field.name] = text === "" ? null : Number(text)
      else if (field.type === "tags")
        values[field.name] = text
          ? text
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : []
      else values[field.name] = text
    }
    const id = editing && editing !== "new" ? editing.id : null
    startTransition(async () => {
      const result = await saveRow(table, id, values, revalidate)
      if (!result.ok) {
        toast.error(`Couldn't save ${noun}`, { description: result.error })
        return
      }
      toast.success(id ? `${capitalize(noun)} updated` : `${capitalize(noun)} added`)
      setEditing(null)
    })
  }

  function confirmDelete() {
    if (!deleting) return
    const target = deleting
    startTransition(async () => {
      const result = await deleteRow(table, target.id, revalidate)
      if (!result.ok) toast.error(`Couldn't delete ${noun}`, { description: result.error })
      else toast.success(`${capitalize(noun)} deleted`)
      setDeleting(null)
    })
  }

  const current = editing && editing !== "new" ? editing : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {searchKeys.length > 0 && (
          <InputGroup className="sm:max-w-xs">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              placeholder={`Search ${noun}s…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
        )}
        <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        {editable && (
          <Button onClick={() => setEditing("new")}>
            <PlusIcon data-icon="inline-start" />
            Add {noun}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{rows.length === 0 ? `No ${noun}s yet` : "No matches"}</EmptyTitle>
            <EmptyDescription>
              {rows.length === 0
                ? editable
                  ? (emptyText ?? `Add your first ${noun} to get started.`)
                  : "Nothing here yet."
                : "Try a different search."}
            </EmptyDescription>
          </EmptyHeader>
          {rows.length === 0 && editable && (
            <EmptyContent>
              <Button variant="outline" onClick={() => setEditing("new")}>
                <PlusIcon data-icon="inline-start" />
                Add {noun}
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.header} className={column.className}>
                    {column.header}
                  </TableHead>
                ))}
                {editable && (
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id} className={cn(onRowClick && "cursor-pointer")} onClick={() => onRowClick?.(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.header} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                  {editable && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                          <MoreHorizontalIcon />
                          <span className="sr-only">Open actions</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => setEditing(row)}>
                              <PencilIcon />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(row)}>
                              <Trash2Icon />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className={cn("max-h-[90svh] overflow-y-auto", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
          <DialogHeader>
            <DialogTitle>{current ? `Edit ${noun}` : `New ${noun}`}</DialogTitle>
            <DialogDescription>
              {current ? "Update the details below." : `Fill in the details for the new ${noun}.`}
            </DialogDescription>
          </DialogHeader>
          <form key={current?.id ?? "new"} action={submit} className="flex flex-col gap-6">
            <FieldGroup className="grid grid-cols-2 gap-4">
              {fields.map((field) => (
                <Field key={field.name} className={field.half ? "col-span-2 sm:col-span-1" : "col-span-2"}>
                  <FieldLabel htmlFor={`f-${field.name}`}>
                    {field.label}
                    {field.required && <span className="text-destructive">*</span>}
                  </FieldLabel>
                  <FieldInput field={field} value={current?.[field.name]} />
                </Field>
              ))}
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner data-icon="inline-start" />}
                {current ? "Save changes" : `Add ${noun}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {noun}?</AlertDialogTitle>
            <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={pending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function FieldInput({ field, value }: { field: FieldDef; value: unknown }) {
  const id = `f-${field.name}`
  const initial = value == null ? (field.defaultValue ?? "") : Array.isArray(value) ? value.join(", ") : String(value)

  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          id={id}
          name={field.name}
          defaultValue={initial}
          placeholder={field.placeholder}
          required={field.required}
          rows={4}
        />
      )
    case "select":
      return (
        <SimpleSelect
          id={id}
          name={field.name}
          options={field.options ?? []}
          defaultValue={initial || null}
          allowEmpty={!field.required}
        />
      )
    case "rating":
      return (
        <SimpleSelect id={id} name={field.name} options={RATING_OPTIONS} defaultValue={initial || null} allowEmpty />
      )
    default:
      return (
        <Input
          id={id}
          name={field.name}
          type={field.type === "tags" ? "text" : (field.type ?? "text")}
          step={field.type === "number" ? "any" : undefined}
          defaultValue={initial}
          placeholder={field.type === "tags" ? (field.placeholder ?? "Comma, separated") : field.placeholder}
          required={field.required}
        />
      )
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
