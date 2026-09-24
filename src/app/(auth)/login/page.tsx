import type { Metadata } from "next"

import { AuthForm } from "@/components/auth-form"
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/demo-users"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams
  const demo = process.env.DEMO_MODE === "true"

  return (
    <AuthForm
      next={typeof next === "string" ? next : undefined}
      demoUsers={demo ? DEMO_USERS : []}
      demoPassword={demo ? DEMO_PASSWORD : undefined}
    />
  )
}
