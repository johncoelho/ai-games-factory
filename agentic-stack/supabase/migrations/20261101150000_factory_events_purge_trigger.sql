-- Sem pg_cron neste plano: a limpeza (eventos com mais de 21 dias) roda sozinha, em cerca de 1% das gravacoes de eventos.
create or replace function public.factory_events_purge_maybe() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.01 then
    delete from public.factory_events where ts < now() - interval '21 days';
  end if;
  return null;
end $$;
revoke all on function public.factory_events_purge_maybe() from public;
drop trigger if exists factory_events_purge_trg on public.factory_events;
create trigger factory_events_purge_trg after insert on public.factory_events
  for each statement execute function public.factory_events_purge_maybe();
