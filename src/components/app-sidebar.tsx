"use client"

import { ExternalLinkIcon, LogOutIcon, SettingsIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { signOut } from "@/app/(auth)/actions"
import { Logo } from "@/components/logo"
import { useCan } from "@/components/permissions-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { initials } from "@/lib/format"
import { NAV } from "@/lib/navigation"

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  if (href === "/crm")
    return pathname === "/crm" || pathname.startsWith("/crm/pipelines") || pathname.startsWith("/crm/deals")
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppSidebar({ name, email, roleName }: { name: string; email: string; roleName: string }) {
  const pathname = usePathname()
  const can = useCan()
  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((group) => group.items.length > 0)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-1">
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <Logo />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isActive(pathname, item.href)}
                      render={
                        item.external ? (
                          <a href={item.href} target="_blank" rel="noopener noreferrer" />
                        ) : (
                          <Link href={item.href} />
                        )
                      }
                    >
                      <item.icon />
                      <span>{item.title}</span>
                      {item.external && <ExternalLinkIcon className="ml-auto size-3.5 text-muted-foreground" />}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Settings"
              isActive={isActive(pathname, "/settings")}
              render={<Link href="/settings" />}
            >
              <SettingsIcon />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<div />}>
              <Avatar className="size-8">
                <AvatarFallback>{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {roleName} · {email}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={signOut}>
              <SidebarMenuButton type="submit" tooltip="Sign out">
                <LogOutIcon />
                <span>Sign out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
