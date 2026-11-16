-- Issue ativa do agente no evento (owner/repo#N). Coluna opcional; a view publica NAO a expoe.
alter table public.factory_events
  add column if not exists issue text;

do $$ begin
  alter table public.factory_events
    add constraint factory_events_issue_fmt
    check (issue is null or issue ~ '^[A-Za-z0-9-]+/[A-Za-z0-9._-]+#[0-9]{1,7}$');
exception when duplicate_object then null; end $$;

-- Versiona a view de ferias que existia so em producao (definicao identica, sem mudar grants).
create or replace view public.factory_agent_ultimo as
  select game, agent, max(ts) as ultimo, min(ts) as primeiro
  from public.factory_events_public
  group by game, agent;
