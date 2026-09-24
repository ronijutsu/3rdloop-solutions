"use client"

import {
  AlarmClockIcon,
  BellIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  CircleCheckIcon,
  FlagIcon,
  HandshakeIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PiggyBankIcon,
  UserPlusIcon,
  VoteIcon,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { markNotificationsRead } from "@/lib/actions/notifications"
import { fromNow } from "@/lib/format"
import type { Notification, NotificationKind } from "@/lib/notifications"
import { cn } from "@/lib/utils"

const ICON: Record<NotificationKind, LucideIcon> = {
  task_due: CalendarClockIcon,
  task_overdue: AlarmClockIcon,
  task_assigned: UserPlusIcon,
  task_note: MessageSquareIcon,
  decision_new: VoteIcon,
  decision_closing: AlarmClockIcon,
  decision_result: CircleCheckIcon,
  budget_proposed: PiggyBankIcon,
  milestone_due: FlagIcon,
  follow_up: HandshakeIcon,
  content_due: MegaphoneIcon,
}

const TONE: Record<Notification["tone"], string> = {
  info: "bg-primary/10 text-primary",
  success: "bg-primary/10 text-primary",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
}

const POLL_MS = 60_000

/** Bell with live notifications: due dates, decisions, assignments, budgets, follow-ups. Polls every minute. */
export function NotificationBell() {
  const router = useRouter()
  const [items, setItems] = useState<Notification[] | null>(null)
  const [open, setOpen] = useState(false)
  const unread = items?.filter((i) => !i.read).length ?? 0

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" })
      if (res.ok) setItems((await res.json()).items)
    } catch {
      // Offline or signed out: keep the last list.
    }
  }, [])

  useEffect(() => {
    const first = setTimeout(refresh, 0)
    const timer = setInterval(refresh, POLL_MS)
    const onFocus = () => void refresh()
    window.addEventListener("focus", onFocus)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      window.removeEventListener("focus", onFocus)
    }
  }, [refresh])

  async function markRead(keys: string[]) {
    setItems((list) => list?.map((i) => (keys.includes(i.key) ? { ...i, read: true } : i)) ?? null)
    const r = await markNotificationsRead(keys)
    if (!r.ok) toast.error("Couldn't update notifications", { description: r.error })
  }

  function openItem(item: Notification) {
    setOpen(false)
    if (!item.read) void markRead([item.key])
    router.push(item.href)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) void refresh()
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          />
        }
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-medium">Notifications</p>
            <p className="text-xs text-muted-foreground">{unread ? `${unread} unread` : "You're all caught up"}</p>
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void markRead(items!.filter((i) => !i.read).map((i) => i.key))}
            >
              <CheckCheckIcon data-icon="inline-start" />
              Mark all read
            </Button>
          )}
        </div>
        {items === null ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <BellIcon className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">Nothing needs you right now</p>
            <p className="text-xs text-muted-foreground">
              Due dates, new decisions, assignments, and follow-ups show up here.
            </p>
          </div>
        ) : (
          <div className="max-h-[min(60svh,32rem)] overflow-y-auto overscroll-contain">
            <ul className="flex flex-col py-1">
              {items.map((item) => {
                const Icon = ICON[item.kind] ?? BellIcon
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                        item.read && "opacity-60"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                          TONE[item.tone]
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="line-clamp-2 text-sm font-medium">{item.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{item.detail}</span>
                        <span className="text-[11px] text-muted-foreground">{fromNow(item.at)}</span>
                      </span>
                      {!item.read && (
                        <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
