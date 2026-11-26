-- 07_fix_sync_no_auth_users_dependency.sql
-- Ejecuta este script en el SQL Editor de Supabase para poblar businesses, business_members y affiliations
-- sin depender de leer auth.users desde el disparador.

create or replace function public.resolve_sync_user_id()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is not null then
    return v_uid;
  end if;

  select owner_user_id into v_uid
  from public.businesses
  where owner_user_id is not null
  order by created_at asc
  limit 1;

  if v_uid is not null then
    return v_uid;
  end if;

  select user_id into v_uid
  from public.business_members
  where user_id is not null
  order by created_at asc
  limit 1;

  if v_uid is not null then
    return v_uid;
  end if;

  return '00000000-0000-0000-0000-000000000001'::uuid;
end;
$$;

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
  v_uid := public.resolve_sync_user_id();
  v_email := coalesce(nullif(trim(new.contact_email), ''), 'sin-correo@genesis.local');
  v_owner_name := coalesce(nullif(trim(new.company_name), ''), 'Administrador');

  select id into v_business_id
  from public.businesses
  where (new.rif is not null and trim(new.rif) <> '' and tax_id = trim(new.rif))
     or lower(name) = lower(coalesce(nullif(trim(new.company_name), ''), 'Genesis-app'))
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

  select id into v_affiliation_id
  from public.affiliations
  where business_id = v_business_id
     or (v_email <> 'sin-correo@genesis.local' and lower(email) = lower(v_email))
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

update public.commerce_accounts
set updated_at = now();

select 'commerce_accounts' as tabla, count(*) as total from public.commerce_accounts
union all
select 'businesses', count(*) from public.businesses
union all
select 'business_members', count(*) from public.business_members
union all
select 'affiliations', count(*) from public.affiliations;
