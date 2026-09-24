-- Keep AI Help suggestions with the question so they survive navigation and are shared with the team.
alter table public.idea_questions
  add column ai_suggestion text,
  add column ai_tips text[] not null default '{}',
  add column ai_suggested_at timestamptz;
