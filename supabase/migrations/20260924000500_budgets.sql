-- Monthly budgets, proposed and approved through founder voting.

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  status text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected', 'withdrawn', 'superseded')),
  notes text,
  decision_id uuid unique references public.decisions (id) on delete set null,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
-- At most one approved budget per month.
create unique index budgets_one_approved_per_month on public.budgets (month) where status = 'approved';

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  category text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  notes text,
  unique (budget_id, category)
);

-- The linked decision's outcome decides the budget. A newly approved budget
-- supersedes the month's previous one.
create or replace function public.sync_budget_with_decision()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  b public.budgets;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  select * into b from public.budgets where decision_id = new.id;
  if not found then
    return new;
  end if;

  if new.status = 'approved' then
    update public.budgets set status = 'superseded'
      where month = b.month and status = 'approved' and id <> b.id;
    update public.budgets set status = 'approved' where id = b.id;
  elsif new.status in ('rejected', 'withdrawn') then
    update public.budgets set status = new.status where id = b.id;
  elsif new.status = 'open' and b.status in ('rejected', 'withdrawn') then
    update public.budgets set status = 'proposed' where id = b.id;
  end if;
  return new;
end $$;

create trigger decisions_sync_budget after update of status on public.decisions
  for each row execute function public.sync_budget_with_decision();

alter table public.budgets enable row level security;
alter table public.budget_lines enable row level security;

create policy "rbac read" on public.budgets for select to authenticated using (public.has_permission('finance.view'));
create policy "rbac write" on public.budgets for all to authenticated
  using (public.has_permission('finance.edit')) with check (public.has_permission('finance.edit'));
create policy "rbac read" on public.budget_lines for select to authenticated
  using (public.has_permission('finance.view'));
create policy "rbac write" on public.budget_lines for all to authenticated
  using (public.has_permission('finance.edit')) with check (public.has_permission('finance.edit'));
