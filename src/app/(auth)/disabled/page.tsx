import { redirect } from "next/navigation"

import { signOut } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { getMember } from "@/lib/auth"

export default async function DisabledPage() {
  const { profile } = await getMember()
  if (!profile) redirect("/login")
  if (profile.role !== "disabled") redirect("/")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your account doesn&apos;t have access</CardTitle>
        <CardDescription>
          You&apos;re signed in as {profile.email}, but your account is disabled. Ask an admin to assign you a role in
          Settings → Team.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <form action={signOut}>
          <Button variant="outline" type="submit">
            Sign out
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}
