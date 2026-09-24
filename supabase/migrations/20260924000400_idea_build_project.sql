-- When an idea reaches step 8 (Build and launch the MVP), open a project for it,
-- seeded with the playbook's MVP foundations as tasks. Runs once per idea.

create or replace function public.open_build_project()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  project_id uuid;
  item text;
  i int := 0;
begin
  if new.stage >= 8 and old.stage < 8
     and not exists (select 1 from public.projects where idea_id = new.id) then
    insert into public.projects (name, description, status, idea_id, owner_id, start_date, due_date)
    values (
      new.title || ' — MVP',
      coalesce('Build and launch the MVP. ' || new.solution, 'Build and launch the MVP.'),
      'active',
      new.id,
      coalesce(auth.uid(), new.created_by),
      current_date,
      current_date + 42  -- the playbook's 2–6 week window
    )
    returning id into project_id;

    foreach item in array array[
      'Authentication and access controls',
      'Core workflow',
      'Payments or pilot billing',
      'Admin controls, analytics, and error monitoring',
      'Customer support and feedback collection',
      'Human-review workflow',
      'Release to a small controlled group'
    ] loop
      insert into public.tasks (project_id, title, status, priority, position)
      values (project_id, item, 'todo', case when i < 2 then 'high' else 'medium' end, i);
      i := i + 1;
    end loop;
  end if;
  return new;
end $$;

create trigger ideas_open_build_project after update of stage on public.ideas
  for each row execute function public.open_build_project();
