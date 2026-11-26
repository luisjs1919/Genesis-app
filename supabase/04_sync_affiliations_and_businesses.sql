-- 04_sync_affiliations_and_businesses.sql
-- Ejecuta este script en el SQL Editor de Supabase para vincular affiliations, businesses y business_members

-- 1. Completar columnas y políticas de public.affiliations
alter table public.affiliations
  add column if not exists business_id uuid references public.businesses(id) on delete cascade,
  add column if not exists user_id uuid;

create index if not exists idx_affiliations_user_id
  on public.affiliations(user_id);

create index if not exists idx_affiliations_business_id
  on public.affiliations(business_id);

drop policy if exists "affiliations_select_own_or_member" on public.affiliations;
create policy "affiliations_select_own_or_member"
on public.affiliations for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.businesses b
    where b.id = affiliations.business_id
      and (
        b.owner_user_id = auth.uid()
        or exists (
          select 1 from public.business_members bm
          where bm.business_id = b.id and bm.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "affiliations_update_own_or_owner" on public.affiliations;
create policy "affiliations_update_own_or_owner"
on public.affiliations for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.businesses b
    where b.id = affiliations.business_id and b.owner_user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.businesses b
    where b.id = affiliations.business_id and b.owner_user_id = auth.uid()
  )
);

-- 2. Función para crear/vincular negocio + miembro + afiliación activa en un solo paso
create or replace function public.activate_or_link_business(
  p_business_name text,
  p_owner_name text,
  p_email text,
  p_phone text default null,
  p_tax_id text default null,
  p_plan text default 'Multidispositivo (PC + Tablet + Móvil)',
  p_app_state jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_business_id uuid;
  v_affiliation_id uuid;
begin
  if v_uid is null then
    raise exception 'Usuario no autenticado';
  end if;

  -- Buscar negocio existente del usuario o crear uno nuevo
  select id into v_business_id
  from public.businesses
  where owner_user_id = v_uid
  order by created_at asc
  limit 1;

  if v_business_id is null then
    insert into public.businesses (
      name,
      owner_user_id,
      tax_id,
      app_state
    ) values (
      coalesce(nullif(trim(p_business_name), ''), 'Genesis-app'),
      v_uid,
      nullif(trim(p_tax_id), ''),
      coalesce(p_app_state, '{}'::jsonb)
    )
    returning id into v_business_id;
  else
    update public.businesses
    set name = coalesce(nullif(trim(p_business_name), ''), name),
        tax_id = coalesce(nullif(trim(p_tax_id), ''), tax_id),
        app_state = case
          when p_app_state is not null and p_app_state <> '{}'::jsonb then p_app_state
          else app_state
        end,
        updated_at = now()
    where id = v_business_id;
  end if;

  -- Asegurar membresía en business_members
  insert into public.business_members (
    business_id,
    user_id,
    role
  ) values (
    v_business_id,
    v_uid,
    'owner'
  )
  on conflict (business_id, user_id) do update
  set role = excluded.role;

  -- Buscar afiliación existente por user_id o email y marcarla como activa
  select id into v_affiliation_id
  from public.affiliations
  where user_id = v_uid
     or (p_email is not null and lower(email) = lower(trim(p_email)))
  order by created_at desc
  limit 1;

  if v_affiliation_id is null then
    insert into public.affiliations (
      business_id,
      user_id,
      business_name,
      owner_name,
      email,
      phone,
      plan,
      status
    ) values (
      v_business_id,
      v_uid,
      coalesce(nullif(trim(p_business_name), ''), 'Genesis-app'),
      coalesce(nullif(trim(p_owner_name), ''), 'Administrador'),
      coalesce(nullif(trim(p_email), ''), ''),
      nullif(trim(p_phone), ''),
      coalesce(nullif(trim(p_plan), ''), 'Multidispositivo (PC + Tablet + Móvil)'),
      'active'
    );
  else
    update public.affiliations
    set business_id = v_business_id,
        user_id = v_uid,
        business_name = coalesce(nullif(trim(p_business_name), ''), business_name),
        owner_name = coalesce(nullif(trim(p_owner_name), ''), owner_name),
        email = coalesce(nullif(trim(p_email), ''), email),
        phone = coalesce(nullif(trim(p_phone), ''), phone),
        status = 'active'
    where id = v_affiliation_id;
  end if;

  return v_business_id;
end;
$$;

grant execute on function public.activate_or_link_business(text, text, text, text, text, text, jsonb) to authenticated;
