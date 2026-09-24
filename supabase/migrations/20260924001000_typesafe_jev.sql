-- Jev is TypeSafe's System One model (https://docs.typesafe.ai). Its calibrated verdict is stored beside
-- the written briefing (free OpenRouter model) that lives in jev_analysis.
alter table public.decisions
  add column jev_verdict jsonb;

create or replace function public.save_jev_review(p_decision uuid, p_verdict jsonb, p_briefing jsonb, p_focus text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_permission('decisions.view') and public.has_permission('ai.use')) then
    raise exception 'Not allowed to ask Jev';
  end if;
  -- A part that failed this time keeps its previous value instead of being wiped.
  update public.decisions
    set jev_verdict = coalesce(p_verdict, jev_verdict),
        jev_analysis = coalesce(p_briefing, jev_analysis),
        jev_focus = nullif(btrim(p_focus), ''),
        jev_analyzed_at = now()
    where id = p_decision;
end $$;

drop function public.save_jev_analysis(uuid, jsonb, text);
