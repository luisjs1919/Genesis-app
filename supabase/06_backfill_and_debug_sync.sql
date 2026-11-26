-- 06_backfill_and_debug_sync.sql
-- 1. Asegura que el trigger exista y no falle silenciosamente por políticas o datos
create or replace function public.sync_commerce_account_to_cloud()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_business_id uuid;
  v_affiliation_id uuid;
  v_email text;
  v_owner_name text;
begin
  v_uid := auth.uid();

  if v_uid is null then
    select id into v_uid
    from auth.users
    order by created_at asc
    limit 1;
  end if;

  if v_uid is null then
    return new;
  end if;

  v_email := coalesce(nullif(trim(new.contact_email), ''), 'sin-correo@genesis.local');
  v_owner_name := coalesce(nullif(trim(new.company_name), ''), 'Administrador');

  -- 1. Buscar o crear en public.businesses
  select id into v_business_id
  from public.businesses
  where (new.rif is not null and trim(new.rif) <> '' and tax_id = trim(new.rif))
     or owner_user_id = v_uid
  order by created_at asc
  limit 1;

  if v_business_id is null then
    insert into public.businesses (
      name,
      owner_user_id,
      tax_id,
      app_state
    ) values (
      coalesce(nullif(trim(new.company_name), ''), 'Genesis-app'),
      v_uid,
      nullif(trim(new.rif), ''),
      '{}'::jsonb
    )
    returning id into v_business_id;
  else
    update public.businesses
    set name = coalesce(nullif(trim(new.company_name), ''), name),
        tax_id = coalesce(nullif(trim(new.rif), ''), tax_id),
        updated_at = now()
    where id = v_business_id;
  end if;

  -- 2. Vincular en public.business_members
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

  -- 3. Crear o actualizar en public.affiliations con estado 'active'
  select id into v_affiliation_id
  from public.affiliations
  where business_id = v_business_id
     or user_id = v_uid
     or (v_email <> '' and lower(email) = lower(v_email))
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
      coalesce(nullif(trim(new.company_name), ''), 'Genesis-app'),
      v_owner_name,
      v_email,
      nullif(trim(new.contact_phone), ''),
      'Multidispositivo (PC + Tablet + Móvil)',
      'active'
    );
  else
    update public.affiliations
    set business_id = v_business_id,
        user_id = v_uid,
        business_name = coalesce(nullif(trim(new.company_name), ''), business_name),
        email = case when v_email <> '' and v_email <> 'sin-correo@genesis.local' then v_email else email end,
        phone = coalesce(nullif(trim(new.contact_phone), ''), phone),
        status = 'active'
    where id = v_affiliation_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_commerce_account_to_cloud on public.commerce_accounts;
create trigger trg_sync_commerce_account_to_cloud
after insert or update on public.commerce_accounts
for each row
execute function public.sync_commerce_account_to_cloud();

-- 2. Migrar/sincronizar todos los registros existentes en commerce_accounts
update public.commerce_accounts
set updated_at = now();

-- 3. Verificación inmediata: muestra conteos y filas creadas
select 'commerce_accounts' as tabla, count(*) as total from public.commerce_accounts
union all
select 'businesses', count(*) from public.businesses
union all
select 'business_members', count(*) from public.business_members
union all
select 'affiliations', count(*) from public.affiliations;
