-- Real folders for the Files explorer (nested, can be empty, renamable).

create table public.file_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  parent_id uuid references public.file_folders (id) on delete restrict,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
-- Sibling names are unique (case-insensitive); root folders share the null parent.
create unique index file_folders_unique_name
  on public.file_folders (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));

alter table public.uploads add column folder_id uuid references public.file_folders (id) on delete restrict;

-- Carry over the old free-text folder labels.
insert into public.file_folders (name)
select distinct btrim(folder) from public.uploads where btrim(folder) <> '' and btrim(folder) <> 'General';
update public.uploads u set folder_id = f.id
from public.file_folders f
where f.parent_id is null and lower(f.name) = lower(btrim(u.folder));

alter table public.uploads drop column folder;

-- A folder can't be moved inside itself or one of its descendants.
create or replace function public.guard_folder_cycle()
returns trigger language plpgsql as $$
begin
  if new.parent_id is not null and exists (
    with recursive ancestors(id) as (
      select new.parent_id
      union all
      select f.parent_id from public.file_folders f join ancestors a on f.id = a.id where f.parent_id is not null
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'A folder can''t be moved inside itself';
  end if;
  return new;
end $$;

create trigger file_folders_guard_cycle before insert or update of parent_id on public.file_folders
  for each row execute function public.guard_folder_cycle();

alter table public.file_folders enable row level security;
create policy "rbac read" on public.file_folders for select to authenticated
  using (public.has_permission('files.view'));
create policy "rbac write" on public.file_folders for all to authenticated
  using (public.has_permission('files.edit')) with check (public.has_permission('files.edit'));
