-- 3rdLoop Solutions — core schema
-- Every table is internal: only approved founders can read/write (see is_founder()).
-- The one exception is public survey responses (anon can answer active surveys).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles & founder access
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('pending', 'founder', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role public.member_role not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_founder()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('founder', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- The very first account becomes admin; everyone after that waits for approval.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'pending'::public.member_role else 'admin'::public.member_role end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Members can't promote themselves.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin can change member roles';
  end if;
  return new;
end $$;

create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy "read own or as founder" on public.profiles for select
  using (id = auth.uid() or public.is_founder());
create policy "update own or as admin" on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Idea incubator + 10-step playbook
-- ---------------------------------------------------------------------------

create type public.idea_status as enum ('active', 'parked', 'killed', 'scaled');

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  -- Step 1: one-page hypothesis
  target_customer text,
  problem text,
  solution text,
  outcome text,
  why_pay text,
  why_us text,
  assumptions text,
  -- Current playbook step, 1..10
  stage smallint not null default 1 check (stage between 1 and 10),
  status public.idea_status not null default 'active',
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.idea_questions (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  stage smallint not null check (stage between 1 and 10),
  question text not null,
  source text not null default 'founder' check (source in ('ai', 'founder')),
  required boolean not null default true,
  answer text,
  answered_by uuid references public.profiles (id),
  answered_at timestamptz,
  position int not null default 0,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.idea_questions (idea_id, stage);

-- A go/no-go record per stage.
create table public.idea_stage_reviews (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  stage smallint not null check (stage between 1 and 10),
  verdict text not null check (verdict in ('go', 'no_go', 'revisit')),
  notes text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- Stamp who answered and when.
create or replace function public.stamp_idea_answer()
returns trigger language plpgsql as $$
begin
  if coalesce(btrim(new.answer), '') = '' then
    new.answer = null;
    new.answered_by = null;
    new.answered_at = null;
  elsif new.answer is distinct from coalesce(old.answer, '') then
    new.answered_by = auth.uid();
    new.answered_at = now();
  end if;
  return new;
end $$;

create trigger idea_questions_stamp before insert or update on public.idea_questions
  for each row execute function public.stamp_idea_answer();
create trigger idea_questions_updated_at before update on public.idea_questions
  for each row execute function public.set_updated_at();

-- Number of required questions still unanswered up to and including a stage.
create or replace function public.idea_open_questions(p_idea uuid, p_through_stage smallint)
returns int language sql stable as $$
  select count(*)::int from public.idea_questions
  where idea_id = p_idea and stage <= p_through_stage and required and answer is null;
$$;

-- THE GATE: an idea can only move forward when every required question for the
-- stages it is leaving is answered. Since Build is step 8, no idea reaches
-- building with open questions from steps 1–7. Moving backwards is always allowed.
create or replace function public.guard_idea_stage()
returns trigger language plpgsql as $$
declare
  open_count int;
  empty_stages int;
begin
  if new.stage > old.stage then
    select count(*) into empty_stages
    from generate_series(1, new.stage - 1) as s(stage)
    where not exists (
      select 1 from public.idea_questions q where q.idea_id = new.id and q.stage = s.stage
    );
    if empty_stages > 0 then
      raise exception 'IDEA_GATE: % earlier step(s) have no questions yet. Generate or add questions first.',
        empty_stages
        using errcode = 'P0001';
    end if;

    open_count := public.idea_open_questions(new.id, (new.stage - 1)::smallint);
    if open_count > 0 then
      raise exception 'IDEA_GATE: % required question(s) are unanswered. Answer them before advancing to step %.',
        open_count, new.stage
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger ideas_guard_stage before update of stage on public.ideas
  for each row execute function public.guard_idea_stage();
create trigger ideas_updated_at before update on public.ideas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Decisions & voting
-- ---------------------------------------------------------------------------

create type public.decision_status as enum ('open', 'approved', 'rejected', 'withdrawn');
create type public.vote_choice as enum ('approve', 'reject', 'abstain');

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  options_considered text,
  idea_id uuid references public.ideas (id) on delete set null,
  status public.decision_status not null default 'open',
  outcome_notes text,
  closes_at timestamptz,
  decided_at timestamptz,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.decision_votes (
  decision_id uuid not null references public.decisions (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  choice public.vote_choice not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (decision_id, voter_id)
);

-- A decision resolves once a strict majority of founders approve or reject.
create or replace function public.recount_decision(d_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  founders int;
  approvals int;
  rejections int;
begin
  if not public.is_founder() and auth.uid() is not null then
    raise exception 'Not allowed';
  end if;
  select count(*) into founders from public.profiles where role in ('founder', 'admin');
  select count(*) filter (where choice = 'approve'), count(*) filter (where choice = 'reject')
    into approvals, rejections
    from public.decision_votes where decision_id = d_id;

  update public.decisions set
    status = case
      when approvals * 2 > founders then 'approved'::public.decision_status
      when rejections * 2 > founders then 'rejected'::public.decision_status
      else 'open'::public.decision_status end,
    decided_at = case when approvals * 2 > founders or rejections * 2 > founders then coalesce(decided_at, now()) end
  where id = d_id and status <> 'withdrawn';
end $$;

create or replace function public.tally_decision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recount_decision(coalesce(new.decision_id, old.decision_id));
  return null;
end $$;

create or replace function public.guard_vote()
returns trigger language plpgsql as $$
begin
  if (select status from public.decisions where id = new.decision_id) = 'withdrawn' then
    raise exception 'This decision was withdrawn';
  end if;
  if (select closes_at from public.decisions where id = new.decision_id) < now() then
    raise exception 'Voting on this decision has closed';
  end if;
  new.voter_id = auth.uid();
  return new;
end $$;

create trigger decision_votes_guard before insert or update on public.decision_votes
  for each row execute function public.guard_vote();
create trigger decision_votes_tally after insert or update or delete on public.decision_votes
  for each row execute function public.tally_decision();
create trigger decision_votes_updated_at before update on public.decision_votes
  for each row execute function public.set_updated_at();
create trigger decisions_updated_at before update on public.decisions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Documents, templates, uploads
-- ---------------------------------------------------------------------------

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'other'
    check (category in ('b2b_script', 'b2c_script', 'lead_gen', 'proposal', 'sop', 'research', 'other')),
  description text,
  body_html text not null default '',
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled',
  content jsonb not null default '{"type":"doc","content":[]}',
  template_id uuid references public.document_templates (id) on delete set null,
  idea_id uuid references public.ideas (id) on delete set null,
  category text,
  created_by uuid references public.profiles (id) default auth.uid(),
  updated_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  folder text not null default 'General',
  tags text[] not null default '{}',
  idea_id uuid references public.ideas (id) on delete set null,
  uploaded_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create trigger document_templates_updated_at before update on public.document_templates
  for each row execute function public.set_updated_at();
create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- CRM
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  industry text,
  size text,
  segment text check (segment in ('ai_tooling', 'enterprise_crm', 'saas', 'other')),
  location text,
  notes text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  title text,
  linkedin text,
  notes text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  name text not null,
  position int not null default 0,
  probability int not null default 0 check (probability between 0 and 100),
  kind text not null default 'open' check (kind in ('open', 'won', 'lost'))
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  stage_id uuid not null references public.pipeline_stages (id),
  title text not null,
  company_id uuid references public.companies (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  value numeric(14, 2) not null default 0,
  currency text not null default 'USD',
  expected_close date,
  owner_id uuid references public.profiles (id) default auth.uid(),
  notes text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  kind text not null default 'note' check (kind in ('note', 'call', 'email', 'meeting', 'task')),
  body text not null,
  due_at timestamptz,
  done boolean not null default false,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger deals_updated_at before update on public.deals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Lead generation (crawl4ai + AI)
-- ---------------------------------------------------------------------------

create table public.lead_searches (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  segment text not null check (segment in ('ai_tooling', 'enterprise_crm', 'saas', 'other')),
  seed_urls text[] not null default '{}',
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  error text,
  lead_count int not null default 0,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  search_id uuid references public.lead_searches (id) on delete set null,
  company_name text not null,
  website text,
  industry text,
  location text,
  summary text,
  pain_signals text[] not null default '{}',
  suggested_offer text,
  fit_score int check (fit_score between 0 and 100),
  segment text check (segment in ('ai_tooling', 'enterprise_crm', 'saas', 'other')),
  status text not null default 'new' check (status in ('new', 'qualified', 'converted', 'discarded')),
  company_id uuid references public.companies (id) on delete set null,
  source_url text,
  created_at timestamptz not null default now()
);
create unique index leads_unique_website on public.leads (lower(website)) where website is not null;

-- ---------------------------------------------------------------------------
-- Problem hunter & surveyor
-- ---------------------------------------------------------------------------

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  who_has_it text,
  source_type text not null default 'other'
    check (source_type in ('interview', 'reddit', 'forum', 'review', 'social', 'observation', 'other')),
  source_url text,
  frequency smallint check (frequency between 1 and 5),
  severity smallint check (severity between 1 and 5),
  willingness_to_pay smallint check (willingness_to_pay between 1 and 5),
  status text not null default 'spotted' check (status in ('spotted', 'validating', 'promoted', 'dismissed')),
  idea_id uuid references public.ideas (id) on delete set null,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger problems_updated_at before update on public.problems
  for each row execute function public.set_updated_at();

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  idea_id uuid references public.ideas (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger surveys_updated_at before update on public.surveys
  for each row execute function public.set_updated_at();

create table public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  position int not null default 0,
  prompt text not null,
  kind text not null default 'text' check (kind in ('text', 'long_text', 'single', 'multi', 'scale')),
  options text[] not null default '{}',
  required boolean not null default false
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  respondent_name text,
  respondent_email text,
  answers jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Planning: roadmap, OKRs, projects
-- ---------------------------------------------------------------------------

create table public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  lane text not null default 'product' check (lane in ('product', 'sales', 'marketing', 'operations', 'finance')),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'done', 'dropped')),
  start_date date,
  end_date date,
  idea_id uuid references public.ideas (id) on delete set null,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger roadmap_items_updated_at before update on public.roadmap_items
  for each row execute function public.set_updated_at();

create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  period text not null,
  owner_id uuid references public.profiles (id) default auth.uid(),
  status text not null default 'on_track' check (status in ('on_track', 'at_risk', 'off_track', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger objectives_updated_at before update on public.objectives
  for each row execute function public.set_updated_at();

create table public.key_results (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.objectives (id) on delete cascade,
  title text not null,
  start_value numeric not null default 0,
  target_value numeric not null,
  current_value numeric not null default 0,
  unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger key_results_updated_at before update on public.key_results
  for each row execute function public.set_updated_at();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('planning', 'active', 'on_hold', 'done')),
  idea_id uuid references public.ideas (id) on delete set null,
  owner_id uuid references public.profiles (id) default auth.uid(),
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assignee_id uuid references public.profiles (id),
  due_date date,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Networking, resources, finance, content
-- ---------------------------------------------------------------------------

create table public.network_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  organization text,
  role text,
  relationship text not null default 'peer'
    check (relationship in ('investor', 'mentor', 'advisor', 'partner', 'customer', 'peer', 'other')),
  email text,
  linkedin text,
  strength smallint check (strength between 1 and 5),
  last_contacted date,
  next_follow_up date,
  notes text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger network_contacts_updated_at before update on public.network_contacts
  for each row execute function public.set_updated_at();

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text,
  description text,
  category text not null default 'other'
    check (category in ('playbook', 'tool', 'article', 'course', 'template', 'legal', 'finance', 'other')),
  upload_id uuid references public.uploads (id) on delete set null,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  occurred_on date not null default current_date,
  kind text not null check (kind in ('income', 'expense')),
  category text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  description text,
  recurring text not null default 'none' check (recurring in ('none', 'monthly', 'yearly')),
  project_id uuid references public.projects (id) on delete set null,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null default 'linkedin'
    check (channel in ('linkedin', 'x', 'blog', 'newsletter', 'youtube', 'podcast', 'other')),
  status text not null default 'idea' check (status in ('idea', 'drafting', 'review', 'scheduled', 'published')),
  publish_date date,
  body text,
  url text,
  owner_id uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger content_items_updated_at before update on public.content_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: founders-only on every internal table
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'ideas', 'idea_questions', 'idea_stage_reviews', 'decisions', 'decision_votes',
    'document_templates', 'documents', 'uploads', 'companies', 'contacts', 'pipelines',
    'pipeline_stages', 'deals', 'activities', 'lead_searches', 'leads', 'problems',
    'surveys', 'survey_questions', 'survey_responses', 'roadmap_items', 'objectives',
    'key_results', 'projects', 'tasks', 'network_contacts', 'resources', 'transactions',
    'content_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "founders full access" on public.%I for all to authenticated using (public.is_founder()) with check (public.is_founder())',
      t);
  end loop;
end $$;

-- A founder can only change or remove their own vote.
drop policy "founders full access" on public.decision_votes;
create policy "founders read votes" on public.decision_votes for select to authenticated
  using (public.is_founder());
create policy "founders cast own vote" on public.decision_votes for insert to authenticated
  with check (public.is_founder() and voter_id = auth.uid());
create policy "founders change own vote" on public.decision_votes for update to authenticated
  using (public.is_founder() and voter_id = auth.uid());
create policy "founders retract own vote" on public.decision_votes for delete to authenticated
  using (public.is_founder() and voter_id = auth.uid());

-- Public survey links: anyone can read an active survey and submit a response.
create policy "public reads active surveys" on public.surveys for select to anon
  using (status = 'active');
create policy "public reads active survey questions" on public.survey_questions for select to anon
  using (exists (select 1 from public.surveys s where s.id = survey_id and s.status = 'active'));
create policy "public answers active surveys" on public.survey_responses for insert to anon, authenticated
  with check (exists (select 1 from public.surveys s where s.id = survey_id and s.status = 'active'));

-- ---------------------------------------------------------------------------
-- Storage: private bucket for uploaded documents
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "founders read files" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_founder());
create policy "founders upload files" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_founder());
create policy "founders update files" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.is_founder());
create policy "founders delete files" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_founder());
