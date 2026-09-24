import { format, formatDistanceToNowStrict, parseISO } from "date-fns"

export function labelize(value: string | null | undefined) {
  if (!value) return "—"
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
}

export function formatDate(value: string | null | undefined, pattern = "MMM d, yyyy") {
  if (!value) return "—"
  return format(parseISO(value), pattern)
}

export function fromNow(value: string | null | undefined) {
  if (!value) return "—"
  return `${formatDistanceToNowStrict(parseISO(value))} ago`
}

/** All amounts are Philippine pesos (₱). */
export function formatMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n)
}

export function initials(name: string | null | undefined) {
  return (name ?? "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function options<const T extends readonly string[]>(values: T) {
  return values.map((value) => ({ value, label: labelize(value) }))
}
