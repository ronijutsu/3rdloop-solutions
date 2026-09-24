"use client"

import { UserPlusIcon } from "lucide-react"
import { useState } from "react"

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Person } from "@/lib/agile"
import { initials } from "@/lib/format"

const nameOf = (p: Person) => p.full_name ?? p.email

export function PersonAvatar({ person, size = "sm" }: { person: Person; size?: "sm" | "default" }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Avatar size={size}>
          {person.avatar_url && <AvatarImage src={person.avatar_url} alt="" />}
          <AvatarFallback className="text-[10px]">{initials(nameOf(person))}</AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{nameOf(person)}</TooltipContent>
    </Tooltip>
  )
}

export function AvatarStack({ people, max = 3 }: { people: Person[]; max?: number }) {
  if (!people.length) return null
  return (
    <AvatarGroup aria-label={people.map(nameOf).join(", ")}>
      {people.slice(0, max).map((p) => (
        <PersonAvatar key={p.id} person={p} />
      ))}
      {people.length > max && (
        <AvatarGroupCount className="size-6 text-[10px]">+{people.length - max}</AvatarGroupCount>
      )}
    </AvatarGroup>
  )
}

/** Pick any number of people. Changes are applied as they're toggled. */
export function AssigneePicker({
  people,
  value,
  onChange,
  disabled,
}: {
  people: Person[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  // Local copy so quick successive toggles build on each other instead of on a stale server value.
  const [picked, setPicked] = useState(value)
  const key = [...value].sort().join(",")
  const [synced, setSynced] = useState(key)
  if (synced !== key) {
    setSynced(key)
    setPicked(value)
  }
  const selected = people.filter((p) => picked.includes(p.id))
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-auto min-h-8 flex-wrap justify-start gap-1.5 py-1 font-normal"
            aria-label="Assigned to"
          />
        }
      >
        {selected.length ? (
          selected.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2 pl-0.5 text-xs"
            >
              <Avatar size="sm" className="size-5">
                <AvatarFallback className="text-[9px]">{initials(nameOf(p))}</AvatarFallback>
              </Avatar>
              {nameOf(p)}
            </span>
          ))
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <UserPlusIcon className="size-4" />
            Unassigned
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search people…" />
          <CommandList>
            <CommandEmpty>No one found.</CommandEmpty>
            <CommandGroup>
              {people.map((p) => {
                const checked = picked.includes(p.id)
                return (
                  <CommandItem
                    key={p.id}
                    value={`${nameOf(p)} ${p.email}`}
                    data-checked={checked}
                    onSelect={() => {
                      const next = checked ? picked.filter((id) => id !== p.id) : [...picked, p.id]
                      setPicked(next)
                      onChange(next)
                    }}
                  >
                    <Avatar size="sm" className="size-5">
                      <AvatarFallback className="text-[9px]">{initials(nameOf(p))}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{nameOf(p)}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
