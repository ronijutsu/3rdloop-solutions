"use client"

import { FileIcon, LayoutTemplateIcon } from "lucide-react"
import { useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { categoryLabel } from "@/lib/constants"
import { cn } from "@/lib/utils"

import { createDocument } from "../actions"

type Template = { id: string; name: string; category: string; description: string | null }

export function TemplatePicker({ templates, ideaId }: { templates: Template[]; ideaId: string | null }) {
  // One document per click: every card is disabled while the chosen one is being created.
  const [pending, startTransition] = useTransition()
  const [chosen, setChosen] = useState<string | null>(null)
  const choices = [
    {
      id: null,
      name: "Blank document",
      category: null,
      description: "Start from scratch or let AI Draft write the first version.",
    },
    ...templates,
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {choices.map((choice) => {
        const key = choice.id ?? "blank"
        return (
          <PickerCard
            key={key}
            title={choice.name}
            description={choice.description}
            icon={choice.id ? LayoutTemplateIcon : FileIcon}
            badge={choice.category ? categoryLabel(choice.category) : undefined}
            dashed={!choice.id}
            disabled={pending}
            chosen={pending && chosen === key}
            onPick={() => {
              setChosen(key)
              startTransition(() => createDocument(choice.id, ideaId))
            }}
          />
        )
      })}
    </div>
  )
}

function PickerCard({
  title,
  description,
  icon: Icon,
  badge,
  dashed,
  disabled,
  chosen,
  onPick,
}: {
  title: string
  description: string | null
  icon: typeof FileIcon
  badge?: string
  dashed?: boolean
  disabled: boolean
  chosen: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className="group h-full rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait"
    >
      <Card
        className={cn(
          "h-full transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-md group-active:translate-y-0 group-disabled:translate-y-0 group-disabled:shadow-none",
          dashed && "border-dashed",
          disabled && !chosen && "opacity-50"
        )}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            {chosen ? (
              <Spinner className="size-5 text-primary" />
            ) : (
              <Icon className="size-5 text-muted-foreground transition-colors group-hover:text-primary" />
            )}
            {badge && <Badge variant="secondary">{badge}</Badge>}
          </div>
          <CardTitle className="mt-2">{chosen ? "Creating…" : title}</CardTitle>
          {description && <CardDescription className="line-clamp-3">{description}</CardDescription>}
        </CardHeader>
      </Card>
    </button>
  )
}
