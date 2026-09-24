-- Jev, the AI decision advisor: its latest analysis is stored on the decision so the whole team sees it.
alter table public.decisions
  add column jev_analysis jsonb,
  add column jev_focus text,
  add column jev_analyzed_at timestamptz;

-- Anyone who can view decisions and use AI may store Jev's analysis (and nothing else on the decision).
create or replace function public.save_jev_analysis(p_decision uuid, p_analysis jsonb, p_focus text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_permission('decisions.view') and public.has_permission('ai.use')) then
    raise exception 'Not allowed to ask Jev';
  end if;
  update public.decisions
    set jev_analysis = p_analysis, jev_focus = nullif(btrim(p_focus), ''), jev_analyzed_at = now()
    where id = p_decision;
end $$;
