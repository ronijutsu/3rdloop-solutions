"use client"

import { CheckCircle2Icon, CircleAlertIcon, KeyRoundIcon, LockIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Fragment, useOptimistic, useState, useTransition } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { SimpleSelect } from "@/components/simple-select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { formatDate, initials } from "@/lib/format"
import type { Database } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

import {
  createMember,
  createRole,
  deleteRole,
  resetMemberPassword,
  setMemberRole,
  setRolePermission,
  updateMyName,
  changeMyPassword,
} from "./actions"

type Tables = Database["public"]["Tables"]
type Profile = Tables["profiles"]["Row"]
type Role = Tables["roles"]["Row"]
type PermissionRow = Tables["permissions"]["Row"]
type Grant = Tables["role_permissions"]["Row"]

const LOCKED_ROLES = new Set(["admin", "disabled"])

function notify(result: { ok: boolean; error?: string }, success: string) {
  if (result.ok) toast.success(success)
  else toast.error("Something went wrong", { description: result.error })
}

export function SettingsView({
  me,
  members,
  roles,
  permissions,
  grants,
  canManageTeam,
  canManageRoles,
  integrations,
}: {
  me: Profile
  members: Profile[]
  roles: Role[]
  permissions: PermissionRow[]
  grants: Grant[]
  canManageTeam: boolean
  canManageRoles: boolean
  integrations: { ai: boolean; models: string[]; crawler: boolean; jev: boolean; admin: boolean }
}) {
  const [name, setName] = useState(me.full_name ?? "")
  const [pending, startTransition] = useTransition()
  const roleOptions = roles.map((r) => ({ value: r.key, label: r.name }))
  const roleName = (key: string) => roles.find((r) => r.key === key)?.name ?? key

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>
              {me.email} · {roleName(me.role)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field>
              <FieldLabel htmlFor="me-name">Full name</FieldLabel>
              <Input id="me-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </CardContent>
          <CardFooter>
            <Button
              disabled={pending || name === (me.full_name ?? "")}
              onClick={() => startTransition(async () => notify(await updateMyName(name), "Profile updated"))}
            >
              Save
            </Button>
          </CardFooter>
          <PasswordForm />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Configured through server environment variables.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Integration
              ok={integrations.ai}
              name="OpenRouter (free models only)"
              detail={integrations.ai ? integrations.models.join(" → ") : "Set OPENROUTER_API_KEY"}
            />
            <Integration
              ok={integrations.jev}
              name="Jev by TypeSafe (decisions)"
              detail={integrations.jev ? "System One verdicts on decisions" : "Set TYPESAFE_API_KEY"}
            />
            <Integration
              ok={integrations.crawler}
              name="crawl4ai"
              detail={integrations.crawler ? "Lead crawling enabled" : "Set CRAWL4AI_URL"}
            />
            <Integration
              ok={integrations.admin}
              name="Account administration"
              detail={integrations.admin ? "Admins can create accounts" : "Set SUPABASE_SECRET_KEY"}
            />
          </CardContent>
        </Card>
      </div>

      <TeamCard
        me={me}
        members={members}
        roleOptions={roleOptions}
        roleName={roleName}
        canManage={canManageTeam}
        adminReady={integrations.admin}
      />

      <PermissionMatrix
        roles={roles}
        permissions={permissions}
        grants={grants}
        canManage={canManageRoles}
        members={members}
      />
    </div>
  )
}

function Integration({ ok, name, detail }: { ok: boolean; name: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      {ok ? (
        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      ) : (
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="shrink-0 font-medium">{name}</span>
      <span className="ml-auto min-w-0 text-right break-words text-muted-foreground">{detail}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

function TeamCard({
  me,
  members,
  roleOptions,
  roleName,
  canManage,
  adminReady,
}: {
  me: Profile
  members: Profile[]
  roleOptions: { value: string; label: string }[]
  roleName: (key: string) => string
  canManage: boolean
  adminReady: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState<Profile | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <CardDescription>
          There is no self-registration.{" "}
          {canManage
            ? "Create accounts here and assign each person a role."
            : "Admins create accounts and assign roles."}
        </CardDescription>
        {canManage && (
          <CardAction>
            <Button
              onClick={() => setAdding(true)}
              disabled={!adminReady}
              title={adminReady ? undefined : "Set SUPABASE_SECRET_KEY"}
            >
              <PlusIcon data-icon="inline-start" />
              Add member
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar className="size-9">
                <AvatarFallback>{initials(m.full_name ?? m.email)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {m.full_name ?? m.email}{" "}
                  {m.id === me.id && <span className="text-xs text-muted-foreground">(you)</span>}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {m.email} · added {formatDate(m.created_at)}
                </span>
              </div>
              {canManage && m.id !== me.id ? (
                <>
                  <SimpleSelect
                    className="w-40"
                    size="sm"
                    options={roleOptions}
                    value={m.role}
                    onValueChange={(role) =>
                      startTransition(async () => notify(await setMemberRole(m.id, role), "Role updated"))
                    }
                  />
                  <Button variant="ghost" size="icon-sm" onClick={() => setResetting(m)} disabled={!adminReady}>
                    <KeyRoundIcon />
                    <span className="sr-only">Reset password for {m.email}</span>
                  </Button>
                </>
              ) : (
                <Badge variant={m.role === "disabled" ? "outline" : "secondary"}>{roleName(m.role)}</Badge>
              )}
            </li>
          ))}
        </ul>
      </CardContent>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a team member</DialogTitle>
            <DialogDescription>
              They can sign in right away with this password. Ask them to change it.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-6"
            action={(fd) =>
              startTransition(async () => {
                const result = await createMember({
                  email: String(fd.get("email") ?? ""),
                  full_name: String(fd.get("full_name") ?? ""),
                  password: String(fd.get("password") ?? ""),
                  role: String(fd.get("role") ?? ""),
                })
                notify(result, "Account created")
                if (result.ok) setAdding(false)
              })
            }
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="m-name">Full name</FieldLabel>
                <Input id="m-name" name="full_name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="m-email">Email</FieldLabel>
                <Input id="m-email" name="email" type="email" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="m-password">Temporary password</FieldLabel>
                <Input id="m-password" name="password" type="text" minLength={8} required autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="m-role">Role</FieldLabel>
                <SimpleSelect id="m-role" name="role" options={roleOptions} defaultValue="member" />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner data-icon="inline-start" />}
                Create account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={resetting !== null} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>{resetting?.email}</DialogDescription>
          </DialogHeader>
          <form
            key={resetting?.id}
            className="flex flex-col gap-6"
            action={(fd) =>
              startTransition(async () => {
                const result = await resetMemberPassword(resetting!.id, String(fd.get("password") ?? ""))
                notify(result, "Password reset")
                if (result.ok) setResetting(null)
              })
            }
          >
            <Field>
              <FieldLabel htmlFor="r-password">New password</FieldLabel>
              <Input id="r-password" name="password" type="text" minLength={8} required autoComplete="off" />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                Reset
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Roles & permission matrix
// ---------------------------------------------------------------------------

function PermissionMatrix({
  roles,
  permissions,
  grants,
  canManage,
  members,
}: {
  roles: Role[]
  permissions: PermissionRow[]
  grants: Grant[]
  canManage: boolean
  members: Profile[]
}) {
  const [optimistic, toggle] = useOptimistic(
    new Set(grants.map((g) => `${g.role}:${g.permission}`)),
    (state, change: { key: string; granted: boolean }) => {
      const next = new Set(state)
      if (change.granted) next.add(change.key)
      else next.delete(change.key)
      return next
    }
  )
  const [creating, setCreating] = useState(false)
  const [pending, startTransition] = useTransition()
  const modules = [...new Set(permissions.map((p) => p.module))]
  const inUse = (key: string) => members.filter((m) => m.role === key).length

  function change(role: string, permission: string, granted: boolean) {
    startTransition(async () => {
      toggle({ key: `${role}:${permission}`, granted })
      const result = await setRolePermission(role, permission, granted)
      if (!result.ok) notify(result, "")
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles & permissions</CardTitle>
        <CardDescription>
          Enforced by the database for every request. Admin always has every permission; Disabled has none.
          {!canManage && " Only admins can change this."}
        </CardDescription>
        {canManage && (
          <CardAction>
            <Button variant="outline" onClick={() => setCreating(true)}>
              <PlusIcon data-icon="inline-start" />
              New role
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <div className="-mx-4 overflow-x-auto px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">Permission</TableHead>
                {roles.map((role) => (
                  <TableHead key={role.key} className="min-w-24 text-center">
                    <div className="flex flex-col items-center gap-0.5 py-1">
                      <span className="flex items-center gap-1">
                        {LOCKED_ROLES.has(role.key) && <LockIcon className="size-3 text-muted-foreground" />}
                        {role.name}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {inUse(role.key)} {inUse(role.key) === 1 ? "person" : "people"}
                      </span>
                      {canManage && !role.is_system && (
                        <ConfirmDialog
                          title={`Delete the ${role.name} role?`}
                          description="Move everyone off this role first. Its permissions are removed."
                          onConfirm={async () => notify(await deleteRole(role.key), "Role deleted")}
                          trigger={
                            <Button variant="ghost" size="icon-xs" disabled={pending}>
                              <Trash2Icon />
                              <span className="sr-only">Delete {role.name}</span>
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map((module) => (
                <Fragment key={module}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={roles.length + 1} className="py-1.5 text-xs font-medium text-muted-foreground">
                      {module}
                    </TableCell>
                  </TableRow>
                  {permissions
                    .filter((p) => p.module === module)
                    .map((permission) => (
                      <TableRow key={permission.key}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{permission.label}</span>
                            <code className="text-xs text-muted-foreground">{permission.key}</code>
                          </div>
                        </TableCell>
                        {roles.map((role) => {
                          const locked = LOCKED_ROLES.has(role.key)
                          const checked = role.key === "admin" || optimistic.has(`${role.key}:${permission.key}`)
                          return (
                            <TableCell key={role.key} className="text-center">
                              <Checkbox
                                checked={checked}
                                disabled={!canManage || locked}
                                onCheckedChange={(value) => change(role.key, permission.key, Boolean(value))}
                                aria-label={`${role.name}: ${permission.label}`}
                                className={cn(locked && "opacity-60")}
                              />
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New role</DialogTitle>
            <DialogDescription>Starts with no permissions. Tick what it should allow in the matrix.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-6"
            action={(fd) =>
              startTransition(async () => {
                const result = await createRole(String(fd.get("name") ?? ""), String(fd.get("description") ?? ""))
                notify(result, "Role created")
                if (result.ok) setCreating(false)
              })
            }
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="role-name">Name</FieldLabel>
                <Input id="role-name" name="name" required placeholder="Sales" />
              </Field>
              <Field>
                <FieldLabel htmlFor="role-description">Description</FieldLabel>
                <Input id="role-description" name="description" placeholder="Works the CRM and lead lists" />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                Create role
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function PasswordForm() {
  const [pending, startTransition] = useTransition()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const mismatch = confirm.length > 0 && next !== confirm

  return (
    <form
      className="flex flex-col gap-4 border-t px-(--card-spacing) pt-(--card-spacing) pb-(--card-spacing)"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const r = await changeMyPassword(current, next)
          if (!r.ok) return void toast.error("Couldn't change password", { description: r.error })
          toast.success("Password changed")
          setCurrent("")
          setNext("")
          setConfirm("")
        })
      }}
    >
      <div>
        <p className="font-medium">Change password</p>
        <p className="text-xs text-muted-foreground">Replace the temporary password you were given.</p>
      </div>
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="pw-current">Current password</FieldLabel>
          <Input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="pw-new">New password</FieldLabel>
          <Input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </Field>
        <Field data-invalid={mismatch || undefined}>
          <FieldLabel htmlFor="pw-confirm">Confirm new password</FieldLabel>
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={mismatch || undefined}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match</p>}
        </Field>
      </FieldGroup>
      <Button
        type="submit"
        variant="outline"
        className="self-start"
        disabled={pending || !current || next.length < 8 || next !== confirm}
      >
        {pending && <Spinner data-icon="inline-start" />}
        Change password
      </Button>
    </form>
  )
}
