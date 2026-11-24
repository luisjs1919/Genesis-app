create table if not exists public.affiliations (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  owner_name text not null,
  email text not null,
  phone text,
  plan text not null default 'Multidispositivo (PC + Tablet + Móvil)',
  status text not null default 'pendiente_activacion',
  created_at timestamptz not null default now()
);

alter table public.affiliations enable row level security;

create policy "Permitir insertar afiliaciones desde la web"
on public.affiliations
for insert
to anon, authenticated
with check (true);
