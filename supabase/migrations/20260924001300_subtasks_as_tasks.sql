-- Sub-tasks become full tasks (own code, page, assignees, body, notes, attachments, activity) linked by parent_id.

alter table public.tasks
  add column parent_id uuid references public.tasks (id) on delete cascade;
create index tasks_parent_idx on public.tasks (parent_id);

-- A parent must be in the same project and can't be the task itself or one of its descendants.
create or replace function public.task_parent_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.parent_id is null then return new; end if;
  if new.parent_id = new.id then raise exception 'A task cannot be its own sub-task'; end if;
  if not exists (select 1 from public.tasks where id = new.parent_id and project_id = new.project_id) then
    raise exception 'A sub-task must be in the same project as its parent';
  end if;
  if tg_op = 'UPDATE' and exists (
    with recursive chain as (
      select id, parent_id from public.tasks where id = new.parent_id
      union all
      select t.id, t.parent_id from public.tasks t join chain c on t.id = c.parent_id
    )
    select 1 from chain where id = new.id
  ) then
    raise exception 'That would make a loop of sub-tasks';
  end if;
  return new;
end $$;

create trigger tasks_parent_guard before insert or update of parent_id, project_id on public.tasks
  for each row execute function public.task_parent_guard();

-- Move existing checklist items into child tasks (numbered and logged by the usual triggers).
insert into public.tasks (project_id, parent_id, sprint_id, title, status, position, created_by, created_at)
  select t.project_id, t.id, t.sprint_id, s.title, case when s.done then 'done' else 'todo' end,
         s.position, t.created_by, s.created_at
  from public.task_subtasks s join public.tasks t on t.id = s.task_id
  order by s.task_id, s.position, s.created_at;

drop trigger task_subtasks_activity on public.task_subtasks;
drop table public.task_subtasks;

-- The child-table logger no longer handles sub-tasks.
create or replace function public.task_activity_on_child()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  task uuid := coalesce(new.task_id, old.task_id);
  who text;
begin
  if not exists (select 1 from public.tasks where id = task) then return null; end if;
  if tg_table_name = 'task_assignees' then
    select coalesce(full_name, email) into who from public.profiles where id = coalesce(new.profile_id, old.profile_id);
    perform public.log_task_activity(task, case when tg_op = 'INSERT' then 'assigned' else 'unassigned' end,
      jsonb_build_object('name', who));
  elsif tg_table_name = 'task_notes' then
    perform public.log_task_activity(task, case when tg_op = 'INSERT' then 'note_added' else 'note_deleted' end);
  elsif tg_table_name = 'task_attachments' then
    perform public.log_task_activity(task, case when tg_op = 'INSERT' then 'attachment_added' else 'attachment_removed' end,
      jsonb_build_object('name', coalesce(new.name, old.name)));
  end if;
  return null;
end $$;

-- Parent bookkeeping: its log records sub-task changes and its progress follows the share of finished sub-tasks.
create or replace function public.sync_parent_task()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  parent uuid := coalesce(new.parent_id, old.parent_id);
  child public.tasks := coalesce(new, old);
  detail jsonb;
begin
  if tg_op = 'UPDATE' and old.parent_id is distinct from new.parent_id and old.parent_id is not null then
    -- Moved away from a parent: refresh the old one too.
    update public.tasks p set progress = case when p.status = 'done' then 100 else coalesce((
        select round(100.0 * count(*) filter (where status = 'done') / nullif(count(*), 0))
        from public.tasks where parent_id = p.id and archived_at is null), 0)::int end
      where p.id = old.parent_id;
  end if;
  if parent is null or not exists (select 1 from public.tasks where id = parent) then return null; end if;

  detail := jsonb_build_object('title', child.title, 'number', child.number, 'id', child.id);
  if tg_op = 'INSERT' then
    perform public.log_task_activity(parent, 'subtask_added', detail);
  elsif tg_op = 'DELETE' then
    perform public.log_task_activity(parent, 'subtask_removed', detail);
  elsif old.status is distinct from new.status and (old.status = 'done' or new.status = 'done') then
    perform public.log_task_activity(parent, case when new.status = 'done' then 'subtask_done' else 'subtask_reopened' end, detail);
  end if;

  update public.tasks p set progress = case when p.status = 'done' then 100 else coalesce((
      select round(100.0 * count(*) filter (where status = 'done') / nullif(count(*), 0))
      from public.tasks where parent_id = p.id and archived_at is null), 0)::int end
    where p.id = parent;
  return null;
end $$;

create trigger tasks_sync_parent after insert or delete or update of status, parent_id, archived_at on public.tasks
  for each row execute function public.sync_parent_task();

-- Sub-tasks travel with their parent between sprints and the backlog.
create or replace function public.cascade_task_sprint()
returns trigger language plpgsql set search_path = public as $$
begin
  update public.tasks set sprint_id = new.sprint_id
    where parent_id = new.id and sprint_id is distinct from new.sprint_id;
  return null;
end $$;

create trigger tasks_cascade_sprint after update of sprint_id on public.tasks
  for each row when (old.sprint_id is distinct from new.sprint_id)
  execute function public.cascade_task_sprint();

-- New sub-tasks start in their parent's sprint.
create or replace function public.inherit_parent_sprint()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.parent_id is not null then
    select sprint_id into new.sprint_id from public.tasks where id = new.parent_id;
  end if;
  return new;
end $$;

create trigger tasks_inherit_sprint before insert on public.tasks
  for each row execute function public.inherit_parent_sprint();

-- Sprint snapshots count top-level work only, so sub-task points aren't double counted.
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
                        where sprint_id = p_sprint and archived_at is null and parent_id is null)
  where id = p_sprint;
end $$;

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
                        where sprint_id = p_sprint and status = 'done' and parent_id is null)
  where id = p_sprint;
  -- Unfinished top-level tasks move; their sub-tasks follow via cascade_task_sprint.
  update public.tasks set sprint_id = p_move_to
    where sprint_id = p_sprint and status <> 'done' and parent_id is null;
end $$;
