import {
  BookOpenIcon,
  Building2Icon,
  CalendarRangeIcon,
  ClipboardListIcon,
  FileTextIcon,
  FolderKanbanIcon,
  FolderOpenIcon,
  GaugeIcon,
  GraduationCapIcon,
  HandshakeIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  LightbulbIcon,
  ListTodoIcon,
  MapIcon,
  PiggyBankIcon,
  RadarIcon,
  SearchCheckIcon,
  TargetIcon,
  UsersIcon,
  VoteIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"

import type { Permission } from "@/lib/permissions"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  permission?: Permission
  /** Another site: opens in a new tab instead of client-side navigation. */
  external?: boolean
}

/** The internship program site (separate app: ronijutsu/internship-3rdloop-solutions). */
export const INTERNSHIP_URL = process.env.NEXT_PUBLIC_INTERNSHIP_URL || "https://internship.3rdloopsolutions.com"

export const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/", icon: LayoutDashboardIcon }],
  },
  {
    label: "Discover & decide",
    items: [
      { title: "Idea Incubator", href: "/ideas", icon: LightbulbIcon, permission: "ideas.view" },
      { title: "Problem Hunter", href: "/problems", icon: RadarIcon, permission: "problems.view" },
      { title: "Surveyor", href: "/surveys", icon: ClipboardListIcon, permission: "surveys.view" },
      { title: "Decisions", href: "/decisions", icon: VoteIcon, permission: "decisions.view" },
    ],
  },
  {
    label: "Sell",
    items: [
      { title: "CRM Pipelines", href: "/crm", icon: GaugeIcon, permission: "crm.view" },
      { title: "Companies & Contacts", href: "/crm/companies", icon: UsersIcon, permission: "crm.view" },
      { title: "Lead Generation", href: "/leads", icon: SearchCheckIcon, permission: "leads.view" },
    ],
  },
  {
    label: "Plan",
    items: [
      { title: "Business Roadmap", href: "/roadmap", icon: MapIcon, permission: "planning.view" },
      { title: "Goals & OKRs", href: "/okrs", icon: TargetIcon, permission: "planning.view" },
      { title: "Projects", href: "/projects", icon: FolderKanbanIcon, permission: "planning.view" },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { title: "Documents", href: "/documents", icon: FileTextIcon, permission: "documents.view" },
      { title: "Templates", href: "/templates", icon: LayoutTemplateIcon, permission: "documents.view" },
      { title: "Files", href: "/files", icon: FolderOpenIcon, permission: "files.view" },
      { title: "Resources Library", href: "/resources", icon: BookOpenIcon, permission: "resources.view" },
    ],
  },
  {
    label: "Grow",
    items: [
      { title: "Networking Hub", href: "/network", icon: HandshakeIcon, permission: "network.view" },
      { title: "Content Planner", href: "/content", icon: CalendarRangeIcon, permission: "content.view" },
      { title: "Financial Tracker", href: "/finance", icon: WalletIcon, permission: "finance.view" },
      { title: "Internship Program", href: INTERNSHIP_URL, icon: GraduationCapIcon, external: true },
    ],
  },
]

/** Quick add: everything you can create, and where its create form opens (see useNewParam). */
export type QuickAddItem = {
  title: string
  group: string
  icon: LucideIcon
  permission: Permission
  /** A link to the create form, or "task" for the in-place new-task dialog. */
  href: string | "task"
}

export const QUICK_ADD: QuickAddItem[] = [
  { group: "Discover & decide", title: "Idea", href: "/ideas/new", icon: LightbulbIcon, permission: "ideas.edit" },
  {
    group: "Discover & decide",
    title: "Problem",
    href: "/problems?new=problems",
    icon: RadarIcon,
    permission: "problems.edit",
  },
  {
    group: "Discover & decide",
    title: "Survey",
    href: "/surveys?new=survey",
    icon: ClipboardListIcon,
    permission: "surveys.edit",
  },
  {
    group: "Discover & decide",
    title: "Decision",
    href: "/decisions?new=decision",
    icon: VoteIcon,
    permission: "decisions.create",
  },
  { group: "Sell", title: "Deal", href: "/crm?new=deal", icon: GaugeIcon, permission: "crm.edit" },
  {
    group: "Sell",
    title: "Company",
    href: "/crm/companies?new=companies",
    icon: Building2Icon,
    permission: "crm.edit",
  },
  { group: "Sell", title: "Contact", href: "/crm/companies?new=contacts", icon: UsersIcon, permission: "crm.edit" },
  { group: "Sell", title: "Lead search", href: "/leads", icon: SearchCheckIcon, permission: "leads.run" },
  { group: "Plan", title: "Task", href: "task", icon: ListTodoIcon, permission: "planning.edit" },
  {
    group: "Plan",
    title: "Project",
    href: "/projects?new=projects",
    icon: FolderKanbanIcon,
    permission: "planning.edit",
  },
  {
    group: "Plan",
    title: "Roadmap item",
    href: "/roadmap?new=roadmap_items",
    icon: MapIcon,
    permission: "planning.edit",
  },
  { group: "Plan", title: "Objective", href: "/okrs?new=objective", icon: TargetIcon, permission: "planning.edit" },
  { group: "Knowledge", title: "Document", href: "/documents/new", icon: FileTextIcon, permission: "documents.edit" },
  { group: "Knowledge", title: "Upload files", href: "/files", icon: FolderOpenIcon, permission: "files.edit" },
  {
    group: "Knowledge",
    title: "Resource",
    href: "/resources?new=resources",
    icon: BookOpenIcon,
    permission: "resources.edit",
  },
  {
    group: "Grow",
    title: "Person to follow up",
    href: "/network?new=network_contacts",
    icon: HandshakeIcon,
    permission: "network.edit",
  },
  {
    group: "Grow",
    title: "Content item",
    href: "/content?new=content_items",
    icon: CalendarRangeIcon,
    permission: "content.edit",
  },
  {
    group: "Grow",
    title: "Transaction",
    href: "/finance?new=transactions",
    icon: WalletIcon,
    permission: "finance.edit",
  },
  {
    group: "Grow",
    title: "Budget proposal",
    href: "/finance?new=budget",
    icon: PiggyBankIcon,
    permission: "finance.edit",
  },
]
