-- Signed-in users always vote as themselves; the service role (seed scripts, admin tools)
-- has no session, so it may record a vote for a specific founder.
create or replace function public.guard_vote()
returns trigger language plpgsql as $$
begin
  if (select status from public.decisions where id = new.decision_id) = 'withdrawn' then
    raise exception 'This decision was withdrawn';
  end if;
  if (select closes_at from public.decisions where id = new.decision_id) < now() then
    raise exception 'Voting on this decision has closed';
  end if;
  new.voter_id = coalesce(auth.uid(), new.voter_id);
  return new;
end $$;
