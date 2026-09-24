-- Roadmap items get their own page: a rich-text body, an owner, milestones, links to the work that matters
-- (projects, ideas, decisions, documents, OKRs, files, deals, or any URL), attachments, and dated updates.

alter table public.roadmap_items
  add column body jsonb,
  add column owner_id uuid references public.profiles (id) on delete set null;

create table public.roadmap_milestones (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.roadmap_items (id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  due_date date,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index roadmap_milestones_item_idx on public.roadmap_milestones (item_id);

create table public.roadmap_links (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.roadmap_items (id) on delete cascade,
  kind text not null check (kind in ('project', 'idea', 'decision', 'document', 'objective', 'file', 'deal', 'url')),
  target_id uuid,
  url text check (url is null or url ~* '^https?://'),
  -- Title at the time of linking; the page shows the live title when the target still exists.
  label text not null,
  note text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check ((kind = 'url') = (url is not null) and (kind = 'url') = (target_id is null))
);
create index roadmap_links_item_idx on public.roadmap_links (item_id);
create unique index roadmap_links_unique_target on public.roadmap_links (item_id, kind, target_id) where target_id is not null;

create table public.roadmap_attachments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.roadmap_items (id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index roadmap_attachments_item_idx on public.roadmap_attachments (item_id);

-- Dated progress updates; posted, not edited. Authors may delete their own.
create table public.roadmap_updates (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.roadmap_items (id) on delete cascade,
  author_id uuid not null references public.profiles (id) default auth.uid(),
  body jsonb not null,
  body_html text not null,
  created_at timestamptz not null default now()
);
create index roadmap_updates_item_idx on public.roadmap_updates (item_id);

alter table public.roadmap_milestones enable row level security;
alter table public.roadmap_links enable row level security;
alter table public.roadmap_attachments enable row level security;
alter table public.roadmap_updates enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['roadmap_milestones', 'roadmap_links', 'roadmap_attachments'] loop
    execute format('create policy "rbac read" on public.%I for select to authenticated using (public.has_permission(''planning.view''))', t);
    execute format('create policy "rbac insert" on public.%I for insert to authenticated with check (public.has_permission(''planning.edit''))', t);
    execute format('create policy "rbac update" on public.%I for update to authenticated using (public.has_permission(''planning.edit'')) with check (public.has_permission(''planning.edit''))', t);
    execute format('create policy "rbac delete" on public.%I for delete to authenticated using (public.has_permission(''planning.edit''))', t);
  end loop;
end $$;

create policy "rbac read" on public.roadmap_updates for select to authenticated
  using (public.has_permission('planning.view'));
create policy "post as yourself" on public.roadmap_updates for insert to authenticated
  with check (public.has_permission('planning.edit') and author_id = auth.uid());
create policy "delete own updates" on public.roadmap_updates for delete to authenticated
  using (public.has_permission('planning.edit') and (author_id = auth.uid() or public.has_permission('team.manage')));

-- Attachments share the private project-files bucket (planning permissions) under roadmap/{item_id}/.
