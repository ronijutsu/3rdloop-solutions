-- Agile projects: sprints, a numbered backlog, story points, multiple assignees, sub-tasks, notes,
-- attachments, and an append-only activity log that powers the burndown, velocity, and flow charts.

-- ---------------------------------------------------------------------------
-- Projects get a short key (e.g. CEBU) used in task codes like CEBU-007.
-- ---------------------------------------------------------------------------

alter table public.projects
  add column key text,
  add column task_seq int not null default 0;

create or replace function public.project_key_from_name(p_name text)
returns text language plpgsql stable set search_path = public as $$
declare
  base text := left(regexp_replace(upper(split_part(btrim(p_name), ' ', 1)), '[^A-Z0-9]', '', 'g'), 6);
  candidate text;
  n int := 1;
begin
  if base = '' then base := 'PRJ'; end if;
  candidate := base;
  while exists (select 1 from public.projects where key = candidate) loop
    n := n + 1;
    candidate := base || n;
  end loop;
  return candidate;
end $$;

create or replace function public.set_project_key()
returns trigger language plpgsql set search_path = public as $$
begin
  new.key := upper(nullif(btrim(new.key), ''));
  if new.key is null then new.key := public.project_key_from_name(new.name); end if;
  return new;
end $$;

create trigger projects_set_key before insert or update of key on public.projects
  for each row execute function public.set_project_key();

update public.projects set key = public.project_key_from_name(name) where key is null;
alter table public.projects
  alter column key set not null,
  add constraint projects_key_format check (key ~ '^[A-Z][A-Z0-9]{1,9}$'),
  add constraint projects_key_unique unique (key);

-- ---------------------------------------------------------------------------
-- Sprints
-- ---------------------------------------------------------------------------

create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  goal text,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed')),
  start_date date,
  end_date date,
  -- Snapshots taken when the sprint starts and ends, for the velocity chart.
  committed_points int,
  completed_points int,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index sprints_project_idx on public.sprints (project_id);
create unique index sprints_one_active on public.sprints (project_id) where status = 'active';

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

alter table public.tasks
  add column number int,
  add column sprint_id uuid references public.sprints (id) on delete set null,
  add column kind text not null default 'task'
    check (kind in ('story', 'task', 'bug', 'spike', 'chore', 'deliverable')),
  add column story_points int check (story_points is null or story_points between 0 and 100),
  add column teams text[] not null default '{}',
  add column start_date date,
  add column frequency text not null default 'once'
    check (frequency in ('once', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
  add column reporting_period text,
  add column progress int not null default 0 check (progress between 0 and 100),
  add column body jsonb,
  add column created_by uuid references public.profiles (id) default auth.uid(),
  add column started_at timestamptz,
  add column completed_at timestamptz,
  add column archived_at timestamptz;

create index tasks_project_idx on public.tasks (project_id);
create index tasks_sprint_idx on public.tasks (sprint_id);

-- Number existing tasks per project, oldest first.
with numbered as (
  select id, project_id, row_number() over (partition by project_id order by position, created_at) as n
  from public.tasks
)
update public.tasks t set number = numbered.n from numbered where numbered.id = t.id;
update public.projects p set task_seq = coalesce((select max(number) from public.tasks where project_id = p.id), 0);
update public.tasks set completed_at = updated_at, progress = 100 where status = 'done';
update public.tasks set started_at = updated_at where status in ('in_progress', 'review', 'done');

-- The default only satisfies generated insert types; number_task() always assigns the real number.
alter table public.tasks
  alter column number set default 0,
  alter column number set not null,
  add constraint tasks_number_unique unique (project_id, number);

-- Next number from the project's counter; safe under concurrent inserts because the row is locked.
create or replace function public.number_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.projects set task_seq = task_seq + 1 where id = new.project_id returning task_seq into new.number;
  return new;
end $$;

create trigger tasks_number before insert on public.tasks
  for each row execute function public.number_task();

-- Keep lifecycle timestamps and progress consistent with the status.
create or replace function public.task_lifecycle()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status <> 'todo' and new.started_at is null then new.started_at := now(); end if;
  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status <> 'done' then new.completed_at := coalesce(new.completed_at, now()); end if;
    new.progress := 100;
  elsif tg_op = 'UPDATE' and old.status = 'done' then
    new.completed_at := null;
    if new.progress = 100 then new.progress := 90; end if;
  end if;
  -- A task moved to another project has to leave its sprint.
  if new.sprint_id is not null
     and not exists (select 1 from public.sprints where id = new.sprint_id and project_id = new.project_id) then
    raise exception 'Sprint belongs to a different project';
  end if;
  return new;
end $$;

create trigger tasks_lifecycle before insert or update on public.tasks
  for each row execute function public.task_lifecycle();

-- Several people can own a task.
create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, profile_id)
);
create index task_assignees_profile_idx on public.task_assignees (profile_id);

insert into public.task_assignees (task_id, profile_id)
  select id, assignee_id from public.tasks where assignee_id is not null;
alter table public.tasks drop column assignee_id;

create table public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index task_subtasks_task_idx on public.task_subtasks (task_id);

-- Notes are posted, not edited; authors may delete their own.
create table public.task_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id) default auth.uid(),
  body jsonb not null,
  body_html text not null,
  created_at timestamptz not null default now()
);
create index task_notes_task_idx on public.task_notes (task_id);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index task_attachments_task_idx on public.task_attachments (task_id);

-- ---------------------------------------------------------------------------
-- Activity log: append-only, written only by the triggers below.
-- ---------------------------------------------------------------------------

create table public.task_activity (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index task_activity_task_idx on public.task_activity (task_id, created_at);
create index task_activity_project_idx on public.task_activity (project_id, created_at);

create or replace function public.log_task_activity(p_task uuid, p_action text, p_detail jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.task_activity (task_id, project_id, actor_id, action, detail)
  select p_task, t.project_id, auth.uid(), p_action, p_detail from public.tasks t where t.id = p_task;
end $$;
revoke execute on function public.log_task_activity(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.task_activity_on_task()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f text;
  before_row jsonb;
  after_row jsonb;
  recent bigint;
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity (task_id, project_id, actor_id, action, detail)
    values (new.id, new.project_id, auth.uid(), 'created',
            jsonb_build_object('title', new.title, 'status', new.status, 'sprint_id', new.sprint_id));
    return new;
  end if;

  before_row := to_jsonb(old);
  after_row := to_jsonb(new);
  foreach f in array array['title', 'description', 'status', 'priority', 'kind', 'story_points', 'teams',
    'start_date', 'due_date', 'frequency', 'reporting_period', 'progress', 'sprint_id', 'archived_at'] loop
    if before_row -> f is distinct from after_row -> f then
      insert into public.task_activity (task_id, project_id, actor_id, action, detail)
      values (new.id, new.project_id, auth.uid(), 'changed',
              jsonb_build_object('field', f, 'from', before_row -> f, 'to', after_row -> f));
    end if;
  end loop;

  -- Body edits autosave every second or so; fold a burst from the same person into one entry.
  if old.body is distinct from new.body then
    select id into recent from public.task_activity
      where task_id = new.id and action = 'body_edited' and actor_id is not distinct from auth.uid()
        and created_at > now() - interval '10 minutes'
      order by created_at desc limit 1;
    if recent is null then
      insert into public.task_activity (task_id, project_id, actor_id, action)
      values (new.id, new.project_id, auth.uid(), 'body_edited');
    else
      update public.task_activity set created_at = now() where id = recent;
    end if;
  end if;
  return new;
end $$;

create trigger tasks_activity after insert or update on public.tasks
  for each row execute function public.task_activity_on_task();

create or replace function public.task_activity_on_child()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  task uuid := coalesce(new.task_id, old.task_id);
  who text;
begin
  -- The parent task is gone (cascade delete): nothing to log.
  if not exists (select 1 from public.tasks where id = task) then return null; end if;

  if tg_table_name = 'task_assignees' then
    select coalesce(full_name, email) into who from public.profiles where id = coalesce(new.profile_id, old.profile_id);
    perform public.log_task_activity(task, case when tg_op = 'INSERT' then 'assigned' else 'unassigned' end,
      jsonb_build_object('name', who));
  elsif tg_table_name = 'task_subtasks' then
    if tg_op = 'INSERT' then
      perform public.log_task_activity(task, 'subtask_added', jsonb_build_object('title', new.title));
    elsif tg_op = 'DELETE' then
      perform public.log_task_activity(task, 'subtask_removed', jsonb_build_object('title', old.title));
    elsif old.done is distinct from new.done then
      perform public.log_task_activity(task, case when new.done then 'subtask_done' else 'subtask_reopened' end,
        jsonb_build_object('title', new.title));
    elsif old.title is distinct from new.title then
      perform public.log_task_activity(task, 'subtask_renamed', jsonb_build_object('from', old.title, 'to', new.title));
    end if;
    -- Progress follows the checklist while there is one.
    update public.tasks t set progress = case when t.status = 'done' then 100 else coalesce((
        select round(100.0 * count(*) filter (where done) / nullif(count(*), 0)) from public.task_subtasks where task_id = task
      ), t.progress)::int end
      where t.id = task;
  elsif tg_table_name = 'task_notes' then
    perform public.log_task_activity(task, case when tg_op = 'INSERT' then 'note_added' else 'note_deleted' end);
  elsif tg_table_name = 'task_attachments' then
    perform public.log_task_activity(task, case when tg_op = 'INSERT' then 'attachment_added' else 'attachment_removed' end,
      jsonb_build_object('name', coalesce(new.name, old.name)));
  end if;
  return null;
end $$;

create trigger task_assignees_activity after insert or delete on public.task_assignees
  for each row execute function public.task_activity_on_child();
create trigger task_subtasks_activity after insert or update or delete on public.task_subtasks
  for each row execute function public.task_activity_on_child();
create trigger task_notes_activity after insert or delete on public.task_notes
  for each row execute function public.task_activity_on_child();
create trigger task_attachments_activity after insert or delete on public.task_attachments
  for each row execute function public.task_activity_on_child();

-- Existing tasks get a starting entry so the flow charts have history.
insert into public.task_activity (task_id, project_id, actor_id, action, detail, created_at)
  select id, project_id, null, 'created', jsonb_build_object('title', title, 'status', status), created_at
  from public.tasks;

-- ---------------------------------------------------------------------------
-- Sprint lifecycle
-- ---------------------------------------------------------------------------

create or replace function public.start_sprint(p_sprint uuid)
returns void language plpgsql set search_path = public as $$
declare
  s public.sprints;
begin
  if not public.has_permission('planning.edit') then raise exception 'Not allowed to manage sprints'; end if;
  select * into s from public.sprints where id = p_sprint for update;
  if s.id is null then raise exception 'Sprint not found'; end if;
  if s.status <> 'planned' then raise exception 'Only a planned sprint can be started'; end if;
  if exists (select 1 from public.sprints where project_id = s.project_id and status = 'active') then
    raise exception 'Complete the active sprint before starting another';
  end if;
  update public.sprints set
    status = 'active',
    started_at = now(),
    start_date = coalesce(start_date, current_date),
    end_date = coalesce(end_date, coalesce(start_date, current_date) + 13),
    committed_points = (select coalesce(sum(story_points), 0) from public.tasks
                        where sprint_id = p_sprint and archived_at is null)
  where id = p_sprint;
end $$;

-- Unfinished work moves to p_move_to (another sprint of the same project) or back to the backlog.
create or replace function public.complete_sprint(p_sprint uuid, p_move_to uuid default null)
returns void language plpgsql set search_path = public as $$
declare
  s public.sprints;
begin
  if not public.has_permission('planning.edit') then raise exception 'Not allowed to manage sprints'; end if;
  select * into s from public.sprints where id = p_sprint for update;
  if s.id is null then raise exception 'Sprint not found'; end if;
  if s.status <> 'active' then raise exception 'Only the active sprint can be completed'; end if;
  if p_move_to is not null and not exists (
    select 1 from public.sprints where id = p_move_to and project_id = s.project_id and status = 'planned'
  ) then
    raise exception 'Unfinished work can only move to a planned sprint of this project';
  end if;
  update public.sprints set
    status = 'completed',
    completed_at = now(),
    completed_points = (select coalesce(sum(story_points), 0) from public.tasks
                        where sprint_id = p_sprint and status = 'done')
  where id = p_sprint;
  update public.tasks set sprint_id = p_move_to where sprint_id = p_sprint and status <> 'done';
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.sprints enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_subtasks enable row level security;
alter table public.task_notes enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_activity enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['sprints', 'task_assignees', 'task_subtasks', 'task_attachments'] loop
    execute format('create policy "rbac read" on public.%I for select to authenticated using (public.has_permission(''planning.view''))', t);
    execute format('create policy "rbac insert" on public.%I for insert to authenticated with check (public.has_permission(''planning.edit''))', t);
    execute format('create policy "rbac update" on public.%I for update to authenticated using (public.has_permission(''planning.edit'')) with check (public.has_permission(''planning.edit''))', t);
    execute format('create policy "rbac delete" on public.%I for delete to authenticated using (public.has_permission(''planning.edit''))', t);
  end loop;
end $$;

create policy "rbac read" on public.task_notes for select to authenticated
  using (public.has_permission('planning.view'));
create policy "post as yourself" on public.task_notes for insert to authenticated
  with check (public.has_permission('planning.edit') and author_id = auth.uid());
create policy "delete own notes" on public.task_notes for delete to authenticated
  using (public.has_permission('planning.edit') and (author_id = auth.uid() or public.has_permission('team.manage')));

create policy "rbac read" on public.task_activity for select to authenticated
  using (public.has_permission('planning.view'));
-- No insert/update/delete policies: only the security-definer triggers write the log.

-- ---------------------------------------------------------------------------
-- Attachments bucket: project-files/{project_id}/{task_id}/{uuid}-{name}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)
on conflict (id) do nothing;

create policy "project files read" on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and public.has_permission('planning.view'));
create policy "project files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and public.has_permission('planning.edit'));
create policy "project files update" on storage.objects for update to authenticated
  using (bucket_id = 'project-files' and public.has_permission('planning.edit'));
create policy "project files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and public.has_permission('planning.edit'));
