"use client"

import { LogInIcon } from "lucide-react"
import { useActionState, useRef } from "react"

import { signIn, type AuthState } from "@/app/(auth)/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

type DemoUser = { email: string; full_name: string; roleName: string }

export function AuthForm({
  next,
  demoUsers = [],
  demoPassword,
}: {
  next?: string
  demoUsers?: readonly DemoUser[]
  demoPassword?: string
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, undefined)
  const form = useRef<HTMLFormElement>(null)
  const email = useRef<HTMLInputElement>(null)
  const password = useRef<HTMLInputElement>(null)

  function signInAs(user: DemoUser) {
    if (!email.current || !password.current || !demoPassword) return
    email.current.value = user.email
    password.current.value = demoPassword
    form.current?.requestSubmit()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Founders workspace for 3rdLoop Solutions. Accounts are created by an admin.</CardDescription>
        </CardHeader>
        <form ref={form} action={action}>
          <CardContent>
            <FieldGroup>
              {state?.error && (
                <Alert variant="destructive">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}
              <input type="hidden" name="next" value={next ?? "/"} />
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input ref={email} id="email" name="email" type="email" autoComplete="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  ref={password}
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Sign in
            </Button>
          </CardFooter>
        </form>
      </Card>

      {demoUsers.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Demo accounts</CardTitle>
            <CardDescription>
              One per role, to see how permissions change the workspace. Password: <code>{demoPassword}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {demoUsers.map((user) => (
                <li key={user.email} className="flex items-center gap-3 py-2">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {user.full_name}
                      <Badge variant="secondary">{user.roleName}</Badge>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => signInAs(user)}
                    aria-label={`Sign in as ${user.full_name}`}
                  >
                    <LogInIcon data-icon="inline-start" />
                    Sign in
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
