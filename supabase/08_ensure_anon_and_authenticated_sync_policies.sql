-- 08_ensure_anon_and_authenticated_sync_policies.sql
-- Ejecuta este script en el SQL Editor de Supabase si tu app accede sin usuario autenticado en Auth
-- o necesita leer/actualizar el negocio sincronizado entre dispositivos.

alter table if exists public.businesses enable row level security;
alter table if exists public.commerce_accounts enable row level security;

drop policy if exists "genesis_businesses_select_all" on public.businesses;
create policy "genesis_businesses_select_all"
on public.businesses
for select
to anon, authenticated
using (true);

drop policy if exists "genesis_businesses_insert_all" on public.businesses;
create policy "genesis_businesses_insert_all"
on public.businesses
for insert
to anon, authenticated
with check (true);

drop policy if exists "genesis_businesses_update_all" on public.businesses;
create policy "genesis_businesses_update_all"
on public.businesses
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "genesis_commerce_select_all" on public.commerce_accounts;
create policy "genesis_commerce_select_all"
on public.commerce_accounts
for select
to anon, authenticated
using (true);

drop policy if exists "genesis_commerce_insert_all" on public.commerce_accounts;
create policy "genesis_commerce_insert_all"
on public.commerce_accounts
for insert
to anon, authenticated
with check (true);

drop policy if exists "genesis_commerce_update_all" on public.commerce_accounts;
create policy "genesis_commerce_update_all"
on public.commerce_accounts
for update
to anon, authenticated
using (true)
with check (true);
