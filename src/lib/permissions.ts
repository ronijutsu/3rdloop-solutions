// Permission keys. The database (`permissions` table + RLS) is the source of
// truth; this mirrors the keys so code can refer to them with type safety.

export const PERMISSIONS = [
  "ideas.view",
  "ideas.edit",
  "problems.view",
  "problems.edit",
  "surveys.view",
  "surveys.edit",
  "decisions.view",
  "decisions.create",
  "decisions.vote",
  "crm.view",
  "crm.edit",
  "leads.view",
  "leads.run",
  "leads.edit",
  "documents.view",
  "documents.edit",
  "templates.edit",
  "files.view",
  "files.edit",
  "planning.view",
  "planning.edit",
  "network.view",
  "network.edit",
  "resources.view",
  "resources.edit",
  "finance.view",
  "finance.edit",
  "content.view",
  "content.edit",
  "ai.use",
  "team.manage",
  "roles.manage",
] as const

export type Permission = (typeof PERMISSIONS)[number]

/** Which permission guards writes to each table (used by the generic CRUD layer). */
export const TABLE_EDIT_PERMISSION: Record<string, Permission> = {
  ideas: "ideas.edit",
  idea_questions: "ideas.edit",
  idea_stage_reviews: "ideas.edit",
  problems: "problems.edit",
  surveys: "surveys.edit",
  survey_questions: "surveys.edit",
  decisions: "decisions.create",
  companies: "crm.edit",
  contacts: "crm.edit",
  pipelines: "crm.edit",
  pipeline_stages: "crm.edit",
  deals: "crm.edit",
  activities: "crm.edit",
  leads: "leads.edit",
  documents: "documents.edit",
  document_templates: "templates.edit",
  uploads: "files.edit",
  roadmap_items: "planning.edit",
  objectives: "planning.edit",
  key_results: "planning.edit",
  projects: "planning.edit",
  tasks: "planning.edit",
  network_contacts: "network.edit",
  resources: "resources.edit",
  transactions: "finance.edit",
  content_items: "content.edit",
}

const ACTION_WORDS: Partial<Record<string, string>> = {
  view: "view this",
  edit: "make changes here",
  create: "raise decisions",
  vote: "vote on decisions",
  run: "run lead searches",
  use: "use AI features",
  manage: "manage this",
}

export function describePermission(permission: Permission) {
  const action = permission.split(".")[1]
  return ACTION_WORDS[action] ?? "do that"
}
