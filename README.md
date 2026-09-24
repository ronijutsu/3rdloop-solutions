# 3rdLoop Solutions — Founder Workspace

Internal tool for the 3rdLoop founders: run ideas through the 10-step SaaS playbook, make decisions by vote, sell through the CRM, find leads, and keep documents, plans, and finances in one place.

**Stack:** Next.js 16 (App Router, Server Actions) · Tailwind CSS v4 · shadcn/ui (Base UI) · Supabase (Auth, Postgres + RLS, Storage) · Tiptap · OpenRouter (**free models only**) · crawl4ai

## Modules

| Area | What it does |
| --- | --- |
| **Idea Incubator** | A step-by-step wizard captures each idea as a hypothesis, then it moves through the 10-step playbook. AI writes critical questions for every step, founders add their own, and **AI Help** drafts an answer to any question (saved with the question, marked with [placeholders] instead of invented facts). **An idea cannot advance while required questions are unanswered, and later steps stay locked.** Reaching step 8 (Build) automatically opens a project seeded with MVP tasks. Both rules are enforced in Postgres. |
| **Problem Hunter** | Log problems by hand, or **research them on the web**: crawl4ai reads forums, reviews, and Reddit/social snippets (Philippines first) and AI extracts problems with a verbatim quote as evidence. Score by frequency × severity × willingness to pay, then promote one into an idea. |
| **Surveyor** | Customer-discovery surveys (AI-drafted, past-behaviour questions), with a public link at `/s/<id>` and result summaries. |
| **Decisions** | Raise a yes/no decision, and voting members vote Approve / Reject / Abstain with a comment. It resolves automatically once a strict majority of everyone holding `decisions.vote` agrees. **Jev** ([TypeSafe](https://docs.typesafe.ai) System One) scores each decision with calibrated probabilities: approve / defer / reject, evidence strength, customer pull, reversibility, financial risk, and a weighted readiness score. If Jev's confidence is low, it shows "too close to call". A free OpenRouter model adds a written briefing on options, risks, and missing evidence, drawing on the linked idea, the votes, and the budget. |
| **CRM** | Three default pipelines (AI Tooling Clients, Enterprise CRM, SaaS Customers), a drag-and-drop kanban, weighted forecast, deals with activity timelines, companies, and contacts. |
| **Lead Generation** | Philippine market only. Describe the businesses that would buy from you; AI turns that into searches for those businesses, crawl4ai reads each site, and a free model scores fit with pain signals. Vendors that sell AI/CRM/software and companies outside the Philippines are filtered out. One click adds a lead to the CRM. |
| **Documents & Templates** | Tiptap editor with autosave, AI Draft, and export to **.docx** and **.pdf**. Seeded templates: B2B discovery script, B2C script, outreach sequence, product hypothesis, pilot proposal. |
| **Files** | A file explorer: nested folders in a sidebar, grid/list views, drag-and-drop upload, image and PDF preview, move and link to ideas. Private in Supabase Storage. |
| **Projects (Agile)** | Sprints with goals, a backlog you plan by dragging, a sprint board, and story points. Reports cover burndown, velocity, cumulative flow, burnup, cycle time, and workload. Every task has its own page with a code (e.g. `DENTAL-007`), several assignees, kind, teams, dates, frequency, reporting period, and progress. It also has a Tiptap body, **sub-tasks that are full tasks with their own page**, attachments, notes, an append-only activity log, and archive/delete. |
| **Roadmap · OKRs** | Quarter × lane roadmap board. Each roadmap item has its own page: rich-text details, owner, milestones, linked work (projects, ideas, decisions, documents, OKRs, files, deals, web links), attachments, and dated updates. Objectives have measurable key results. |
| **Financial Tracker** | Income and expenses in Philippine pesos (₱), runway, and **monthly budgets**: a founder proposes a budget, it opens a Decision, and the budget becomes active when the vote passes. Budget vs actual per category. |
| **Networking · Resources · Content** | Relationship follow-ups, a shared reading/tool library, and a content calendar. |
| **Top bar** | On every page: **Jump to** (Ctrl/⌘ K) for pages and create actions, a **New** menu that opens the create form of anything your role can add, and a **notifications bell**. The bell covers your tasks that are due or overdue, new assignments, notes on your tasks, decisions awaiting your vote or closing soon, decision results, budget proposals, your roadmap milestones, follow-ups, and content about to publish. Read state is saved per person. |

## Getting started

Prerequisites: Node 22+, pnpm, Docker.

```bash
pnpm install
cp .env.example .env.local        # then fill it in (see below)

npx supabase start                # local Postgres, Auth, Storage
pnpm db:reset                     # applies migrations, creates demo accounts and demo data

openssl rand -hex 32              # put this in CRAWL4AI_API_TOKEN
pnpm crawler                      # optional: crawl4ai for Lead Generation

pnpm dev
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | From `npx supabase status` (or your hosted project) |
| `SUPABASE_SECRET_KEY` | **Server-only.** Lets admins create accounts and reset passwords, and is used by `pnpm db:seed` |
| `NEXT_PUBLIC_SITE_URL` | Used for survey share links |
| `OPENROUTER_API_KEY` | Enables all AI features |
| `TYPESAFE_API_KEY` | Enables Jev verdicts on decisions (paid per input token, roughly ₱0.01 per decision; output is free) |
| `OPENROUTER_MODELS` | Optional comma-separated fallback chain of **free** models (default: Nex N2.5 Pro → Nemotron 3 Super → `openrouter/free` → Qwen 3.8 27B → Nex N2.5 Mini) |
| `DEMO_MODE` | `true` lists the demo accounts with one-click sign-in on the login page. **Never enable in production.** |
| `CRAWL4AI_URL`, `CRAWL4AI_API_TOKEN` | crawl4ai server. The same token is passed to the container by `pnpm crawler`. |

Everything works without the OpenRouter key. Ideas then start with each step's gate question, and the AI buttons are hidden.

### Accounts and demo users

There is **no self-registration**. Public sign-up is disabled in Supabase (`[auth].enable_signup = false`), and the app has no sign-up page. Admins create accounts in **Settings → Team**.

`pnpm db:seed` creates or resets one demo account per role (password `demo-3rdloop`) and fills every module with a fictional Philippine-market demo story. Re-running skips existing demo data; `pnpm db:seed:data -- --reset` recreates it and only ever removes rows the seed created.

| Account | Role |
| --- | --- |
| admin@3rdloop.demo | Admin |
| founder@3rdloop.demo, cofounder@3rdloop.demo | Founder |
| member@3rdloop.demo | Team member |
| viewer@3rdloop.demo | Viewer |

### Roles and permissions (RBAC)

Access is controlled by a permission matrix stored in the database (`roles`, `permissions`, `role_permissions`). Admins can edit it and create custom roles in **Settings → Roles & permissions**.

| Role | Access |
| --- | --- |
| **Admin** | Everything, including team and role management. Locked: always has every permission. |
| **Founder** | Every module, including finances. Raises decisions and votes. |
| **Team member** | Works in ideas, problems, surveys, CRM, leads, documents, files, planning, network, resources, and content. Uses AI. No finances, no voting, can't manage templates. |
| **Viewer** | Read-only access to everything except finances. Can still export documents. |
| **Disabled** | Can sign in but sees nothing. New accounts default here. |

Every permission is `module.view` / `module.edit`, plus `decisions.create`, `decisions.vote`, `leads.run`, `templates.edit`, `ai.use`, `team.manage`, and `roles.manage`. It is enforced in three layers:

1. **Postgres RLS**, the real boundary. Every policy calls `has_permission('<key>')`, so the matrix applies to any client, including direct API calls with a user's token.
2. **Server actions and pages** check the same permission (`authorize()` / `requirePermission()` in `src/lib/auth.ts`). They return a clear error or redirect to `/no-access`.
3. **UI**: the navigation and buttons are hidden when the role lacks the permission (`useCan()`).

Safeguards in the database: nobody can change their own role, the last admin can't be demoted, built-in roles can't be deleted, and the Admin and Disabled rows of the matrix are fixed.

### Web search, AI, and conventions

- **Free web search:** result pages from DuckDuckGo (Philippines region) are read through crawl4ai; when DuckDuckGo shows its bot challenge, searches fall back to Brave Search automatically. Reddit and most social sites block crawlers, so their search snippets are used as evidence.
- **Currency:** everything is in Philippine pesos (₱, `en-PH` formatting).
- **UI:** light/dark/system theme (next-themes) and Sonner toasts for every action.

### AI: free OpenRouter models only

All AI goes through `src/lib/ai/client.ts`. Before every request it loads OpenRouter's live model list (cached for an hour) and keeps only configured models whose prices are all zero. A paid model can't be called even if someone configures one; a config with no free models is refused. Structured results are requested with `response_format: json_schema`, validated with Zod, and retried once with the validation errors. Free endpoints are rate-limited and occasionally return empty replies, so the client falls through the model chain (at most 3 models per request, OpenRouter's limit) and retries the whole chain once before giving up.

## How it's built

```
src/
  app/(auth)/         login (with optional demo accounts), disabled-account screen
  app/(app)/          every authenticated module (one folder each, with its own actions.ts)
  app/s/[id]/         public survey form (anonymous)
  app/api/leads/      streaming lead-search endpoint (NDJSON progress events)
  components/         app shell, entity-manager (config-driven CRUD table+dialog), editor/
  lib/ai/             OpenRouter client (free-model guard, Zod-validated structured output) and prompts
  lib/auth.ts         requireMember / requirePermission / authorize
  lib/permissions.ts  permission keys and table → permission map
  lib/export/         Tiptap JSON → DOCX (docx) and → PDF (pdfmake)
  lib/playbook.ts     the 10-step playbook definition
  lib/supabase/       server/browser clients, proxy session refresh, generated types
supabase/migrations/  schema, RBAC, RLS, triggers, seed pipelines & templates
scripts/              seed-demo-users.ts (admin API)
```

**Rules live in the database.**
- RBAC as described above: `has_permission()` in every RLS policy (including Storage).
- `guard_idea_stage` blocks moving an idea forward if any earlier step has no questions or has unanswered required questions.
- Votes re-tally through `recount_decision()`. The majority is counted over people whose role has `decisions.vote`, and each voter can only change their own vote.
- Anonymous visitors can read *active* surveys and insert responses, and nothing else.

### Useful scripts

```bash
pnpm typecheck      # next typegen + tsc
pnpm lint
pnpm format         # prettier
pnpm db:reset       # reset the local DB and recreate the demo accounts
pnpm db:seed        # (re)create the demo accounts only
pnpm db:types       # regenerate src/lib/supabase/database.types.ts after a migration
pnpm crawler        # start crawl4ai in Docker
```

### Deploying

1. Create a Supabase project and run `npx supabase link` then `npx supabase db push`.
2. In Supabase Auth settings, **turn off "Allow new users to sign up"** and keep the Email provider enabled. Set the Site URL.
3. Create your first admin: set `SUPABASE_SECRET_KEY` locally to the project's secret key and run `pnpm db:seed`, then change the admin password (or create a real admin and delete the demo accounts). Keep `DEMO_MODE=false`.
4. Deploy the Next.js app (e.g. Vercel) with the env vars above. The lead-search route streams for up to 5 minutes (`maxDuration = 300`), so check your host's function limits.
5. Host crawl4ai somewhere the app can reach and set `CRAWL4AI_URL` and `CRAWL4AI_API_TOKEN`. crawl4ai 0.9+ refuses to listen on a network interface without a token.
