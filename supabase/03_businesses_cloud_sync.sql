-- Ejecuta este script en el SQL Editor de Supabase
alter table public.businesses
  add column if not exists tax_id text,
  add column if not exists app_state jsonb;

create index if not exists idx_businesses_owner_user_id
  on public.businesses(owner_user_id);

create index if not exists idx_business_members_user_id
  on public.business_members(user_id);

drop policy if exists "members_select_business_members" on public.business_members;
create policy "members_select_business_members"
on public.business_members for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.businesses b
    where b.id = business_members.business_id
      and b.owner_user_id = auth.uid()
  )
);

drop policy if exists "members_insert_business_members" on public.business_members;
create policy "members_insert_business_members"
on public.business_members for insert to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.businesses b
    where b.id = business_members.business_id
      and b.owner_user_id = auth.uid()
  )
);
