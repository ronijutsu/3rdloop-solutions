import { options } from "@/lib/format"

export const TEMPLATE_CATEGORIES = [
  { value: "b2b_script", label: "B2B script" },
  { value: "b2c_script", label: "B2C script" },
  { value: "lead_gen", label: "Lead generation" },
  { value: "proposal", label: "Proposal" },
  { value: "sop", label: "SOP" },
  { value: "research", label: "Research" },
  { value: "other", label: "Other" },
]

export const categoryLabel = (value: string | null) =>
  TEMPLATE_CATEGORIES.find((c) => c.value === value)?.label ?? "Uncategorised"

export const SEGMENTS = [
  { value: "ai_tooling", label: "Needs AI tooling" },
  { value: "enterprise_crm", label: "Enterprise CRM" },
  { value: "saas", label: "SaaS customer" },
  { value: "other", label: "Other" },
]

export const segmentLabel = (value: string | null) => SEGMENTS.find((s) => s.value === value)?.label ?? "—"

export const RELATIONSHIPS = options(["investor", "mentor", "advisor", "partner", "customer", "peer", "other"] as const)

// Finance categories. Budgets plan expense categories month by month.
export const INCOME_CATEGORIES = ["Revenue", "Pilot fees", "Consulting", "Grants", "Other income"]
export const EXPENSE_CATEGORIES = [
  "Salaries",
  "Contractors",
  "Software",
  "Infrastructure",
  "AI / API",
  "Marketing",
  "Legal",
  "Office",
  "Travel",
  "Other",
]
