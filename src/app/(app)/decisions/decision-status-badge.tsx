import { Badge } from "@/components/ui/badge"
import { labelize } from "@/lib/format"

export function DecisionStatusBadge({ status }: { status: string }) {
  const variant =
    status === "approved"
      ? "default"
      : status === "rejected"
        ? "destructive"
        : status === "open"
          ? "secondary"
          : "outline"
  return <Badge variant={variant}>{labelize(status)}</Badge>
}
