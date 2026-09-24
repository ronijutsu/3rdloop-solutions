"use client"

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type Option = { value: string; label: string }

export function SimpleSelect({
  id,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select…",
  className,
  size,
  allowEmpty = false,
  disabled = false,
}: {
  id?: string
  name?: string
  options: Option[]
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  size?: "sm" | "default"
  allowEmpty?: boolean
  disabled?: boolean
}) {
  const items = allowEmpty ? [{ value: "", label: "None" }, ...options] : options
  return (
    <Select
      name={name}
      items={items}
      disabled={disabled}
      value={value === undefined ? undefined : (value ?? "")}
      defaultValue={defaultValue ?? undefined}
      onValueChange={(v) => onValueChange?.((v as string | null) ?? "")}
    >
      <SelectTrigger id={id} size={size} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
