-- Layout do escritorio salvo pelo CEO: leitura publica, escrita so do dono.
create table if not exists public.factory_layout (
  id text primary key,
  layout jsonb not null,
  base text not null,
  updated_at timestamptz not null default now()
);
alter table public.factory_layout enable row level security;
create policy factory_layout_read on public.factory_layout for select to anon, authenticated using (true);
create policy factory_layout_owner_ins on public.factory_layout for insert to authenticated with check ((auth.jwt() ->> 'email') = 'joncqs@gmail.com');
create policy factory_layout_owner_upd on public.factory_layout for update to authenticated using ((auth.jwt() ->> 'email') = 'joncqs@gmail.com') with check ((auth.jwt() ->> 'email') = 'joncqs@gmail.com');
