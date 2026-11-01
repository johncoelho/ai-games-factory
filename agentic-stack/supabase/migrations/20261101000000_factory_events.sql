-- Base jarvis-agentic-stack (compartilhada com o JARVIS): tudo da fabrica leva o prefixo factory_.
-- Unica tabela da fabrica: o que cada agente faz agora, duracao e custo.
-- Tickets, squads e aprovacoes NAO vivem aqui (GitHub e repos sao os donos).
create table if not exists public.factory_events (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  game text not null check (length(game) <= 60),
  session_id text,
  agent text not null check (length(agent) <= 60),
  agent_id text,
  event text not null check (length(event) <= 40),
  tool text check (length(tool) <= 60),
  target text check (length(target) <= 200),
  duration_ms integer,
  cost_usd numeric(10,4)
);
create index if not exists factory_events_ts_idx on public.factory_events (ts desc);
create index if not exists factory_events_game_ts_idx on public.factory_events (game, ts desc);

alter table public.factory_events enable row level security;
-- Gravar: so insercao, com a chave anon do hook. Ler: so usuario autenticado (portal).
create policy factory_events_insert on public.factory_events for insert to anon with check (true);
create policy factory_events_read on public.factory_events for select to authenticated using (true);

-- Retencao curta: rode por agendamento (pg_cron ou rotina) para manter so 21 dias.
create or replace function public.factory_events_purge() returns void language sql security invoker
set search_path = public
as $$ delete from public.factory_events where ts < now() - interval '21 days' $$;
