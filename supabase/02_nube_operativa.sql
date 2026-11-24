-- Esquema base en la nube para compartir el mismo usuario y negocio
-- entre PC, Tablet y Teléfono con un solo origen de verdad en PostgreSQL (Supabase).

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null,
  bcv_usd_rate numeric(14,4) not null default 1,
  bcv_eur_rate numeric(14,4) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner', -- owner | cashier | manager
  created_at timestamptz not null default now(),
  unique(business_id, user_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sku text,
  name text not null,
  price_usd numeric(14,2) not null default 0,
  stock numeric(14,3) not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by_user_id uuid not null,
  device_label text not null default 'web', -- pc | tablet | mobile
  payment_method text not null default 'efectivo',
  total_usd numeric(14,2) not null default 0,
  total_bs numeric(14,2) not null default 0,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric(14,3) not null default 1,
  unit_price_usd numeric(14,2) not null default 0
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by_user_id uuid not null,
  category text not null default 'operativo',
  description text not null,
  amount_usd numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.expenses enable row level security;

-- Políticas de acceso para que el mismo usuario autenticado vea y opere su negocio en PC, Tablet y Teléfono
create policy "members_select_business"
on public.businesses for select to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.business_members bm
    where bm.business_id = businesses.id and bm.user_id = auth.uid()
  )
);

create policy "members_insert_business"
on public.businesses for insert to authenticated
with check (owner_user_id = auth.uid());

create policy "members_update_business"
on public.businesses for update to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1 from public.business_members bm
    where bm.business_id = businesses.id and bm.user_id = auth.uid()
  )
);

create policy "members_all_products"
on public.products for all to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = products.business_id
      and (b.owner_user_id = auth.uid() or exists (
        select 1 from public.business_members bm
        where bm.business_id = b.id and bm.user_id = auth.uid()
      ))
  )
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id = products.business_id
      and (b.owner_user_id = auth.uid() or exists (
        select 1 from public.business_members bm
        where bm.business_id = b.id and bm.user_id = auth.uid()
      ))
  )
);

create policy "members_all_sales"
on public.sales for all to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = sales.business_id
      and (b.owner_user_id = auth.uid() or exists (
        select 1 from public.business_members bm
        where bm.business_id = b.id and bm.user_id = auth.uid()
      ))
  )
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id = sales.business_id
      and (b.owner_user_id = auth.uid() or exists (
        select 1 from public.business_members bm
        where bm.business_id = b.id and bm.user_id = auth.uid()
      ))
  )
);

create policy "members_all_sale_items"
on public.sale_items for all to authenticated
using (
  exists (
    select 1 from public.sales s
    join public.businesses b on b.id = s.business_id
    where s.id = sale_items.sale_id
      and (b.owner_user_id = auth.uid() or exists (
        select 1 from public.business_members bm
        where bm.business_id = b.id and bm.user_id = auth.uid()
      ))
  )
)
with check (
  exists (
    select 1 from public.sales s
    join public.businesses b on b.id = s.business_id
    where s.id = sale_items.sale_id
      and (b.owner_user_id = auth.uid() or exists (
        select 1 from public.business_members bm
        where bm.business_id = b.id and bm.user_id = auth.uid()
      ))
  )
);

create policy "members_all_expenses"
on public.expenses for all to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id = expenses.business_id
      and (b.owner_user_id = auth.uid() or exists (
        select 1 from public.business_members bm
        where bm.business_id = b.id and bm.user_id = auth.uid()
      ))
  )
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id = expenses.business_id
      and (b.owner_user_id = auth.uid() or exists (
        select 1 from public.business_members bm
        where bm.business_id = b.id and bm.user_id = auth.uid()
      ))
  )
);

-- Función atómica para registrar venta y descontar stock de forma segura en la nube
create or replace function public.register_cloud_sale(
  p_business_id uuid,
  p_device_label text,
  p_payment_method text,
  p_total_usd numeric,
  p_total_bs numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_prod_id uuid;
  v_prod_name text;
  v_qty numeric;
  v_price numeric;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado';
  end if;

  insert into public.sales (
    business_id,
    created_by_user_id,
    device_label,
    payment_method,
    total_usd,
    total_bs,
    status
  ) values (
    p_business_id,
    auth.uid(),
    coalesce(p_device_label, 'web'),
    coalesce(p_payment_method, 'efectivo'),
    coalesce(p_total_usd, 0),
    coalesce(p_total_bs, 0),
    'completed'
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_prod_id := nullif(v_item->>'product_id', '')::uuid;
    v_prod_name := coalesce(v_item->>'product_name', v_item->>'name', 'Producto');
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    v_price := coalesce((v_item->>'unit_price_usd')::numeric, (v_item->>'price')::numeric, 0);

    insert into public.sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price_usd
    ) values (
      v_sale_id,
      v_prod_id,
      v_prod_name,
      v_qty,
      v_price
    );

    if v_prod_id is not null then
      update public.products
      set stock = greatest(0, stock - v_qty),
          updated_at = now()
      where id = v_prod_id and business_id = p_business_id;
    end if;
  end loop;

  return v_sale_id;
end;
$$;
