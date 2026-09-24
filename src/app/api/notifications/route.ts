import { getMember } from "@/lib/auth"
import { getNotifications } from "@/lib/notifications"

export const dynamic = "force-dynamic"

/** The signed-in person's notifications, polled by the bell in the top bar. */
export async function GET() {
  const { supabase, profile, permissions } = await getMember()
  if (!profile || profile.role === "disabled") return Response.json({ items: [], unread: 0 }, { status: 401 })
  const items = await getNotifications({ supabase, profile, permissions, can: (p) => permissions.has(p) })
  return Response.json({ items, unread: items.filter((i) => !i.read).length })
}
