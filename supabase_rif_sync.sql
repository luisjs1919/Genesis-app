-- Migración v3: Sincronización por RIF + Nombre y RIF inmutables una vez creados
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase

-- 1. Columnas e índices para RIF en businesses, affiliations y sales
alter table public.businesses
  add column if not exists rif text;

create index if not exists idx_businesses_rif
  on public.businesses (rif);

alter table public.affiliations
  add column if not exists rif text;

create index if not exists idx_affiliations_rif
  on public.affiliations (rif);

alter table public.sales
  add column if not exists business_rif text;

create index if not exists idx_sales_business_rif
  on public.sales (business_rif);

-- 2. Trigger para sincronizar y normalizar business_rif en facturas / ventas (sales)
create or replace function public.sync_sale_business_rif()
returns trigger
language plpgsql
as $$
declare
  v_rif text;
begin
  if new.business_rif is not null and btrim(new.business_rif) <> '' then
    new.business_rif := upper(regexp_replace(new.business_rif, '[^a-zA-Z0-9]', '', 'g'));
    return new;
  end if;

  if new.business_id is not null then
    select upper(regexp_replace(coalesce(rif, ''), '[^a-zA-Z0-9]', '', 'g'))
      into v_rif
    from public.businesses
    where id = new.business_id;

    if v_rif is not null and v_rif <> '' then
      new.business_rif := v_rif;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_sale_business_rif on public.sales;

create trigger trg_sync_sale_business_rif
before insert or update on public.sales
for each row
execute function public.sync_sale_business_rif();

-- 3. Trigger para bloquear cualquier modificación posterior de `name` o `rif` una vez creados en `businesses`
--    (Si el registro previo tenía `rif` vacío o NULL, permite asignarlo por primera vez normalizado;
--     una vez que `name` y `rif` existen, no se pueden alterar.)
create or replace function public.lock_business_name_and_rif()
returns trigger
language plpgsql
as $$
declare
  old_name text;
  new_name text;
  old_rif text;
  new_rif text;
begin
  old_name := btrim(coalesce(old.name, ''));
  new_name := btrim(coalesce(new.name, ''));

  if new_name = '' then
    raise exception 'El nombre del establecimiento o factura no puede quedar vacío.';
  end if;

  if old_name <> '' and old_name is distinct from new_name then
    raise exception 'El nombre del establecimiento no se puede modificar una vez creado.';
  end if;

  old_rif := upper(regexp_replace(coalesce(old.rif, ''), '[^a-zA-Z0-9]', '', 'g'));
  new_rif := upper(regexp_replace(coalesce(new.rif, ''), '[^a-zA-Z0-9]', '', 'g'));

  if new_rif <> '' then
    new.rif := new_rif;
  end if;

  if old_rif <> '' and new_rif is distinct from old_rif then
    raise exception 'El RIF del establecimiento no se puede modificar una vez creado.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_single_business_name_change on public.businesses;
drop trigger if exists trg_lock_business_name_and_rif on public.businesses;

create trigger trg_lock_business_name_and_rif
before update on public.businesses
for each row
execute function public.lock_business_name_and_rif();
