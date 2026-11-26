create extension if not exists pgcrypto;

create table if not exists public.commerce_accounts (
  id uuid primary key default gen_random_uuid(),
  rif text not null unique,
  company_name text not null,
  contact_phone text,
  contact_email text,
  address text,
  access_key_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_commerce_accounts_rif
  on public.commerce_accounts (rif);

alter table if exists public.app_state
  add column if not exists commerce_rif text;

create index if not exists idx_app_state_commerce_rif
  on public.app_state (commerce_rif);
