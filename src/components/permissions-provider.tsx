"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

import type { Permission } from "@/lib/permissions"

const PermissionsContext = createContext<ReadonlySet<Permission>>(new Set())

export function PermissionsProvider({ permissions, children }: { permissions: Permission[]; children: ReactNode }) {
  const value = useMemo(() => new Set(permissions), [permissions])
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

/**
 * UI-only permission check, for hiding controls the user can't use.
 * The server actions and RLS policies are what actually enforce access.
 */
export function useCan() {
  const permissions = useContext(PermissionsContext)
  return (permission: Permission) => permissions.has(permission)
}
