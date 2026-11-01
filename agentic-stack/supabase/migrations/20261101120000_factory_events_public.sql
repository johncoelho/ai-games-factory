-- Visao publica do que os agentes fazem: sem caminho de arquivo, custo, sessao ou id. Visitantes (sem login) leem so isto.
create or replace view public.factory_events_public as
  select ts, game, agent, event, tool
  from public.factory_events
  where ts > now() - interval '1 day';
grant select on public.factory_events_public to anon, authenticated;
