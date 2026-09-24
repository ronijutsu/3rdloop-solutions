"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * Quick-add deep links: `/crm?new=deal` asks the page to open its "new deal" form.
 * Returns whether this form was requested and a function that drops the param again (call it on close).
 */
export function useNewParam(key: string) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const requested = params.get("new") === key
  const clear = () => {
    if (!params.has("new")) return
    const next = new URLSearchParams(params)
    next.delete("new")
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false })
  }
  return [requested, clear] as const
}
