-- Role-based access control.
-- Replaces the fixed pending/founder/admin enum with data-driven roles and a
-- permission matrix. Every table's RLS policy checks a permission, so the
-- matrix is enforced by the database for every client.

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.roles (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null,
  description text,
  is_system boolean not null default false,
  position int not null default 100,
  created_at timestamptz not null default now()
);

create table public.permissions (
  key text primary key,
  module text not null,
  label text not null,
  position int not null default 0
);

create table public.role_permissions (
  role text not null references public.roles (key) on delete cascade on update cascade,
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role, permission)
);

insert into public.roles (key, name, description, is_system, position) values
  ('admin', 'Admin', 'Full access, including team and role management.', true, 0),
  ('founder', 'Founder', 'Full access to every module. Votes on decisions.', true, 1),
  ('member', 'Team member', 'Works in most modules. No finances, no voting.', true, 2),
  ('viewer', 'Viewer', 'Read-only access, excluding finances.', true, 3),
  ('disabled', 'Disabled', 'Can sign in but sees nothing.', true, 4);

insert into public.permissions (key, module, label, position) values
  ('ideas.view', 'Idea Incubator', 'View ideas', 10),
  ('ideas.edit', 'Idea Incubator', 'Create, answer, and advance ideas', 11),
  ('problems.view', 'Problem Hunter', 'View problems', 20),
  ('problems.edit', 'Problem Hunter', 'Log and score problems', 21),
  ('surveys.view', 'Surveyor', 'View surveys and results', 30),
  ('surveys.edit', 'Surveyor', 'Build and publish surveys', 31),
  ('decisions.view', 'Decisions', 'View decisions and votes', 40),
  ('decisions.create', 'Decisions', 'Raise, withdraw, and annotate decisions', 41),
  ('decisions.vote', 'Decisions', 'Vote (counts toward the majority)', 42),
  ('crm.view', 'CRM', 'View pipelines, deals, companies, contacts', 50),
  ('crm.edit', 'CRM', 'Manage deals, companies, contacts, activities', 51),
  ('leads.view', 'Lead Generation', 'View leads', 60),
  ('leads.run', 'Lead Generation', 'Run lead searches', 61),
  ('leads.edit', 'Lead Generation', 'Qualify, discard, and convert leads', 62),
  ('documents.view', 'Documents', 'View documents and templates', 70),
  ('documents.edit', 'Documents', 'Write and delete documents', 71),
  ('templates.edit', 'Documents', 'Manage templates', 72),
  ('files.view', 'Files', 'View and download files', 80),
  ('files.edit', 'Files', 'Upload and delete files', 81),
  ('planning.view', 'Planning', 'View roadmap, OKRs, projects', 90),
  ('planning.edit', 'Planning', 'Manage roadmap, OKRs, projects, tasks', 91),
  ('network.view', 'Networking Hub', 'View contacts', 100),
  ('network.edit', 'Networking Hub', 'Manage contacts', 101),
  ('resources.view', 'Resources', 'View resources', 110),
  ('resources.edit', 'Resources', 'Manage resources', 111),
  ('finance.view', 'Finance', 'View finances', 120),
  ('finance.edit', 'Finance', 'Record transactions', 121),
  ('content.view', 'Content Planner', 'View content plan', 130),
  ('content.edit', 'Content Planner', 'Manage content', 131),
  ('ai.use', 'AI', 'Use AI features (drafting, question generation, lead scoring)', 140),
  ('team.manage', 'Administration', 'Create accounts and assign roles', 150),
  ('roles.manage', 'Administration', 'Edit roles and the permission matrix', 151);

-- Admin implicitly has everything (see has_permission); rows are kept for display.
insert into public.role_permissions (role, permission)
select 'admin', key from public.permissions;

insert into public.role_permissions (role, permission)
select 'founder', key from public.permissions where key not in ('team.manage', 'roles.manage');

insert into public.role_permissions (role, permission)
select 'member', key from public.permissions
where key in (
  'ideas.view', 'ideas.edit', 'problems.view', 'problems.edit', 'surveys.view', 'surveys.edit',
  'decisions.view', 'crm.view', 'crm.edit', 'leads.view', 'leads.run', 'leads.edit',
  'documents.view', 'documents.edit', 'files.view', 'files.edit', 'planning.view', 'planning.edit',
  'network.view', 'network.edit', 'resources.view', 'resources.edit', 'content.view', 'content.edit', 'ai.use'
);

insert into public.role_permissions (role, permission)
select 'viewer', key from public.permissions
where key like '%.view' and key <> 'finance.view';

-- ---------------------------------------------------------------------------
-- Move profiles.role from the enum to the roles table
-- ---------------------------------------------------------------------------

-- Policies and functions that reference the old model go first.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where (schemaname = 'public' and policyname in (
            'founders full access', 'founders read votes', 'founders cast own vote',
            'founders change own vote', 'founders retract own vote',
            'read own or as founder', 'update own or as admin'))
       or (schemaname = 'storage' and policyname like 'founders % files')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type text
  using (case role::text when 'pending' then 'disabled' else role::text end);
alter table public.profiles alter column role set default 'disabled';
alter table public.profiles
  add constraint profiles_role_fkey foreign key (role) references public.roles (key) on update cascade;

-- ---------------------------------------------------------------------------
-- Permission checks
-- ---------------------------------------------------------------------------

create or replace function public.role_has_permission(p_role text, p text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_role = 'admin'
    or exists (select 1 from public.role_permissions where role = p_role and permission = p);
$$;

create or replace function public.has_permission(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select public.role_has_permission(role, p) from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role <> 'disabled');
$$;

create or replace function public.my_permissions()
returns setof text language sql stable security definer set search_path = public as $$
  select p.key from public.permissions p
  where public.has_permission(p.key);
$$;

-- ---------------------------------------------------------------------------
-- Profiles: role assignment rules
-- ---------------------------------------------------------------------------

-- New auth users start disabled unless app_metadata already carries a valid role
-- (only the service role can write it; direct SQL inserts do). The admin API writes
-- app_metadata after this trigger runs, so the app assigns the role explicitly too.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested text := new.raw_app_meta_data ->> 'role';
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.roles where key = requested) then requested else 'disabled' end
  );
  return new;
end $$;

create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    -- auth.uid() is null for the service role (seed scripts, admin API).
    if auth.uid() is not null and not public.has_permission('team.manage') then
      raise exception 'You do not have permission to change roles';
    end if;
    if old.role = 'admin' and not exists (
      select 1 from public.profiles where role = 'admin' and id <> old.id
    ) then
      raise exception 'At least one admin must remain';
    end if;
  end if;
  if new.email is distinct from old.email and auth.uid() is not null then
    raise exception 'Email changes go through authentication, not the profile';
  end if;
  return new;
end $$;

-- Protect the permission matrix's invariants.
create or replace function public.guard_role_permissions()
returns trigger language plpgsql as $$
declare
  target text := coalesce(new.role, old.role);
begin
  if target in ('admin', 'disabled') then
    raise exception 'The % role''s permissions are fixed', target;
  end if;
  return coalesce(new, old);
end $$;

create trigger role_permissions_guard before insert or update or delete on public.role_permissions
  for each row execute function public.guard_role_permissions();

create or replace function public.guard_system_roles()
returns trigger language plpgsql as $$
begin
  if old.is_system and (tg_op = 'DELETE' or new.key <> old.key) then
    raise exception 'Built-in roles can''t be renamed or deleted';
  end if;
  return coalesce(new, old);
end $$;

create trigger roles_guard before update or delete on public.roles
  for each row execute function public.guard_system_roles();

-- ---------------------------------------------------------------------------
-- Decisions: the majority counts people who can vote
-- ---------------------------------------------------------------------------

create or replace function public.recount_decision(d_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  voters int;
  approvals int;
  rejections int;
begin
  if auth.uid() is not null and not public.has_permission('decisions.view') then
    raise exception 'Not allowed';
  end if;
  select count(*) into voters from public.profiles where public.role_has_permission(role, 'decisions.vote');
  select count(*) filter (where choice = 'approve'), count(*) filter (where choice = 'reject')
    into approvals, rejections
    from public.decision_votes where decision_id = d_id;

  update public.decisions set
    status = case
      when approvals * 2 > voters then 'approved'::public.decision_status
      when rejections * 2 > voters then 'rejected'::public.decision_status
      else 'open'::public.decision_status end,
    decided_at = case when approvals * 2 > voters or rejections * 2 > voters then coalesce(decided_at, now()) end
  where id = d_id and status <> 'withdrawn';
end $$;

-- Who counts toward the majority (shown on decision pages).
create or replace function public.voting_members()
returns table (id uuid, full_name text, email text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email from public.profiles p
  where public.has_permission('decisions.view') and public.role_has_permission(p.role, 'decisions.vote')
  order by p.full_name;
$$;

create or replace function public.voting_member_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.voting_members();
$$;

-- ---------------------------------------------------------------------------
-- Old helpers and type
-- ---------------------------------------------------------------------------

drop function public.is_founder();
drop function public.is_admin();
drop type public.member_role;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

-- Standard tables: module.view to read, module.edit to write.
do $$
declare
  t record;
begin
  for t in select * from (values
    ('ideas', 'ideas'), ('idea_questions', 'ideas'), ('idea_stage_reviews', 'ideas'),
    ('problems', 'problems'),
    ('surveys', 'surveys'), ('survey_questions', 'surveys'),
    ('companies', 'crm'), ('contacts', 'crm'), ('pipelines', 'crm'), ('pipeline_stages', 'crm'),
    ('deals', 'crm'), ('activities', 'crm'),
    ('documents', 'documents'),
    ('uploads', 'files'),
    ('roadmap_items', 'planning'), ('objectives', 'planning'), ('key_results', 'planning'),
    ('projects', 'planning'), ('tasks', 'planning'),
    ('network_contacts', 'network'),
    ('resources', 'resources'),
    ('transactions', 'finance'),
    ('content_items', 'content')
  ) as x(tbl, module)
  loop
    execute format('create policy "rbac read" on public.%I for select to authenticated using (public.has_permission(%L))',
      t.tbl, t.module || '.view');
    execute format('create policy "rbac insert" on public.%I for insert to authenticated with check (public.has_permission(%L))',
      t.tbl, t.module || '.edit');
    execute format('create policy "rbac update" on public.%I for update to authenticated using (public.has_permission(%L)) with check (public.has_permission(%L))',
      t.tbl, t.module || '.edit', t.module || '.edit');
    execute format('create policy "rbac delete" on public.%I for delete to authenticated using (public.has_permission(%L))',
      t.tbl, t.module || '.edit');
  end loop;
end $$;

-- Templates: readable with documents, managed separately.
create policy "rbac read" on public.document_templates for select to authenticated
  using (public.has_permission('documents.view'));
create policy "rbac write" on public.document_templates for all to authenticated
  using (public.has_permission('templates.edit')) with check (public.has_permission('templates.edit'));

-- Survey responses: read with surveys, delete with edit. Public insert policy is unchanged.
create policy "rbac read" on public.survey_responses for select to authenticated
  using (public.has_permission('surveys.view'));
create policy "rbac delete" on public.survey_responses for delete to authenticated
  using (public.has_permission('surveys.edit'));

-- Decisions.
create policy "rbac read" on public.decisions for select to authenticated
  using (public.has_permission('decisions.view'));
create policy "rbac write" on public.decisions for all to authenticated
  using (public.has_permission('decisions.create')) with check (public.has_permission('decisions.create'));

create policy "rbac read" on public.decision_votes for select to authenticated
  using (public.has_permission('decisions.view'));
create policy "rbac cast own vote" on public.decision_votes for insert to authenticated
  with check (public.has_permission('decisions.vote') and voter_id = auth.uid());
create policy "rbac change own vote" on public.decision_votes for update to authenticated
  using (public.has_permission('decisions.vote') and voter_id = auth.uid());
create policy "rbac retract own vote" on public.decision_votes for delete to authenticated
  using (public.has_permission('decisions.vote') and voter_id = auth.uid());

-- Leads: searching and qualifying are separate permissions.
create policy "rbac read" on public.lead_searches for select to authenticated
  using (public.has_permission('leads.view'));
create policy "rbac run" on public.lead_searches for insert to authenticated
  with check (public.has_permission('leads.run'));
create policy "rbac update" on public.lead_searches for update to authenticated
  using (public.has_permission('leads.run'));

create policy "rbac read" on public.leads for select to authenticated
  using (public.has_permission('leads.view'));
create policy "rbac insert" on public.leads for insert to authenticated
  with check (public.has_permission('leads.run'));
create policy "rbac update" on public.leads for update to authenticated
  using (public.has_permission('leads.edit'));
create policy "rbac delete" on public.leads for delete to authenticated
  using (public.has_permission('leads.edit'));

-- Profiles: active members see the team; you edit yourself; team managers edit anyone.
create policy "read team" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_member());
create policy "update self or as manager" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_permission('team.manage'));

-- RBAC catalog: readable by members, editable by role managers.
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

create policy "read roles" on public.roles for select to authenticated using (public.is_active_member());
create policy "manage roles" on public.roles for all to authenticated
  using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));
create policy "read permissions" on public.permissions for select to authenticated using (public.is_active_member());
create policy "read role permissions" on public.role_permissions for select to authenticated using (public.is_active_member());
create policy "manage role permissions" on public.role_permissions for all to authenticated
  using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));

-- Storage.
create policy "rbac read files" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.has_permission('files.view'));
create policy "rbac upload files" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.has_permission('files.edit'));
create policy "rbac update files" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.has_permission('files.edit'));
create policy "rbac delete files" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.has_permission('files.edit'));
