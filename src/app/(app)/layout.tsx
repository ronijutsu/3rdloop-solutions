import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { PermissionsProvider } from "@/components/permissions-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireMember } from "@/lib/auth"

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { profile, permissions } = await requireMember()

  return (
    <PermissionsProvider permissions={[...permissions]}>
      <SidebarProvider>
        <AppSidebar
          name={profile.full_name ?? profile.email}
          email={profile.email}
          roleName={profile.role_info?.name ?? profile.role}
        />
        <SidebarInset className="min-w-0">
          <AppTopbar />
          <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-6 p-4 md:p-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </PermissionsProvider>
  )
}
