-- Notifications are computed live from the data (due dates, decisions, budgets, …). This table only remembers
-- which ones each person has read. Keys include the relevant date or status, so a changed due date or a new
-- decision outcome shows up as unread again.
create table public.notification_reads (
  profile_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  key text not null,
  read_at timestamptz not null default now(),
  primary key (profile_id, key)
);

alter table public.notification_reads enable row level security;

create policy "own reads" on public.notification_reads for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
