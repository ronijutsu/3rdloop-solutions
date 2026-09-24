<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 3rdLoop Solutions — project notes

- UI is shadcn on **Base UI** (`components.json` style `base-nova`): use the `render` prop, not `asChild`. Toasts: `toast.add({...})` from `@/components/ui/toast`.
- Access is RBAC: pages call `requirePermission("module.view")`, actions call `authorize("module.edit")` and return its error result, client components hide controls with `useCan()`. RLS (`has_permission()`) is the real boundary, so new tables need policies in a migration and new permission keys go in both the `permissions` table and `src/lib/permissions.ts`.
- Mutations are Server Actions (`actions.ts` next to each module). Simple tables use the generic `saveRow`/`deleteRow` in `@/lib/actions/crud` (allowlisted tables, permission from `TABLE_EDIT_PERMISSION`) with `EntityManager`.
- Business rules (founder access, idea stage gate, vote tallying) are enforced in Postgres in `supabase/migrations/`. Add new rules there, not only in the UI. After changing the schema, run `pnpm db:types`.
- PostgREST embeds: when two FKs point at `profiles`, name the FK (e.g. `profiles!documents_updated_by_fkey`).
- AI calls go through `src/lib/ai/client.ts` (OpenRouter over fetch, **free models only**: the client checks live pricing and refuses paid models, so never bypass it). Keep prompts in `src/lib/ai/tasks.ts`. Free models are weaker, so keep schemas simple.
- No self-registration: accounts come from Settings → Team or `pnpm db:seed` (demo users in `src/lib/demo-users.ts`). The admin API writes `app_metadata` after the profile trigger fires, so set `profiles.role` explicitly after creating a user.
- Verify with `pnpm typecheck && pnpm lint && pnpm build`; format with `pnpm format`.
- Toasts use Sonner (`import { toast } from "sonner"`), not the Base UI toast. Confirmations use `@/components/confirm-dialog`; never `window.confirm`/`prompt`.
- Quick add: the top bar links to `<page>?new=<key>`; the page opens its create form via `useNewParam(key)` (`@/hooks/use-new-param`) and clears the param on close. `EntityManager` does this automatically with its table name as the key. Register new create targets in `QUICK_ADD` (`@/lib/navigation`); pages for the sidebar and Ctrl+K live in `NAV` there too.
- Notifications are computed live in `@/lib/notifications` (one source per module, gated by permission); only read state is stored (`notification_reads`). Keys include the date/status so changes resurface as unread.
- Tasks: sub-tasks are rows in `tasks` with `parent_id`; boards, backlog, and charts use top-level tasks only. Task lifecycle, numbering, progress, and the activity log are maintained by triggers — don't set `number`, `started_at`, `completed_at`, or write `task_activity` from app code.
- Attachments use `@/components/attachments` (private `project-files` bucket, path prefix per owner) and notes/updates use `@/components/note-thread`. Render stored rich text with `RichTextView` from its JSON, never saved HTML.
- Jev is TypeSafe System One (`@/lib/ai/jev`, `TYPESAFE_API_KEY`), paid per input token; everything else AI uses free OpenRouter models only.
- Money is always PHP: `formatMoney(value)` (no currency argument). Lead generation is Philippine-market only (`MARKET` in `src/lib/ai/tasks.ts`).
- Web search goes through `searchWeb` / `searchSnippets` / `searchBusinesses` in `src/lib/crawl4ai.ts` (DuckDuckGo, falling back to Brave). Search exclusions are appended in code, not by the model.
- Seed data: `scripts/seed-demo-data.ts` marks rows with `[demo]` so `--reset` removes only its own data. Multi-row inserts send NULL for missing keys, so give every row the same keys.
