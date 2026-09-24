-- Problem Hunter: keep a screenshot of each problem's source page.

alter table public.problems
  add column source_title text,
  add column screenshot_path text,
  add column screenshot_taken_at timestamptz;

-- Evidence screenshots live in their own private bucket, readable with Problem Hunter access
-- (not tied to Files permissions).
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false)
on conflict (id) do nothing;

create policy "evidence read" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and public.has_permission('problems.view'));
create policy "evidence write" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and public.has_permission('problems.edit'));
create policy "evidence replace" on storage.objects for update to authenticated
  using (bucket_id = 'evidence' and public.has_permission('problems.edit'));
create policy "evidence delete" on storage.objects for delete to authenticated
  using (bucket_id = 'evidence' and public.has_permission('problems.edit'));
