import { LockIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { requireMember } from "@/lib/auth"

export default async function NoAccessPage({ searchParams }: PageProps<"/no-access">) {
  const { profile } = await requireMember()
  const { need } = await searchParams

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon />
        </EmptyMedia>
        <EmptyTitle>You don&apos;t have access to this</EmptyTitle>
        <EmptyDescription>
          Your role ({profile.role_info?.name ?? profile.role}) doesn&apos;t include
          {typeof need === "string" ? (
            <>
              {" "}
              the <code>{need}</code> permission
            </>
          ) : (
            " this permission"
          )}
          . Ask an admin if you need it.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" render={<Link href="/" />}>
          Back to dashboard
        </Button>
      </EmptyContent>
    </Empty>
  )
}
