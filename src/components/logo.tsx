import { cn } from "@/lib/utils"

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0 text-primary" aria-hidden="true">
        <circle cx="12" cy="16" r="7.5" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="20" cy="16" r="7.5" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.55" />
        <circle cx="16" cy="9" r="2.5" fill="currentColor" />
      </svg>
      {!compact && <span>3rdLoop Solutions</span>}
    </div>
  )
}
