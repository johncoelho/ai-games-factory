-- Recados para o CEO (caixa de entrada simples): qualquer pessoa deixa, so o CEO le e responde, o visitante ve a propria resposta.
create table if not exists public.factory_messages (
  id uuid primary key default gen_random_uuid(),
  visitor_key text not null check (visitor_key ~ '^[a-zA-Z0-9-]{8,64}$'),
  visitor_name text not null check (length(visitor_name) between 1 and 40),
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  reply text check (reply is null or length(reply) <= 1000),
  replied_at timestamptz
);
create index if not exists factory_messages_key_idx on public.factory_messages (visitor_key, created_at desc);
alter table public.factory_messages enable row level security;
create policy factory_messages_insert on public.factory_messages for insert to anon, authenticated
  with check (reply is null and read_at is null and replied_at is null);
create policy factory_messages_owner_sel on public.factory_messages for select to authenticated
  using ((auth.jwt() ->> 'email') = 'joncqs@gmail.com');
create policy factory_messages_owner_upd on public.factory_messages for update to authenticated
  using ((auth.jwt() ->> 'email') = 'joncqs@gmail.com') with check ((auth.jwt() ->> 'email') = 'joncqs@gmail.com');
create or replace function public.factory_minhas_mensagens(p_key text)
returns table (id uuid, body text, created_at timestamptz, reply text, replied_at timestamptz)
language sql security definer set search_path = public as $$
  select m.id, m.body, m.created_at, m.reply, m.replied_at
  from public.factory_messages m where m.visitor_key = p_key order by m.created_at desc limit 50;
$$;
revoke all on function public.factory_minhas_mensagens(text) from public;
grant execute on function public.factory_minhas_mensagens(text) to anon, authenticated;
