-- ============================================================
-- EPM PARCEIROS — BANCO SUPABASE
-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.investor_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) <= 160),
  whatsapp text not null check (char_length(whatsapp) <= 24),
  city_state text not null check (char_length(city_state) <= 100),
  profile_type text not null check (char_length(profile_type) <= 80),
  source text,
  relationship text check (char_length(relationship) <= 500),
  support_types text[] not null check (cardinality(support_types) >= 1),
  intended_amount numeric(12,2) check (intended_amount is null or intended_amount >= 0),
  payment_preference text,
  motivation text check (char_length(motivation) <= 1000),
  best_contact_period text,
  allow_name_public boolean not null default false,
  lgpd_consent boolean not null default false,
  admin_status text not null default 'novo' check (admin_status in ('novo','contato','reuniao','confirmado','pago','pausado','encerrado')),
  confirmed_amount numeric(12,2) check (confirmed_amount is null or confirmed_amount >= 0),
  admin_notes text check (char_length(admin_notes) <= 2000)
);

create index if not exists investor_leads_created_at_idx on public.investor_leads(created_at desc);
create index if not exists investor_leads_status_idx on public.investor_leads(admin_status);

alter table public.admins enable row level security;
alter table public.investor_leads enable row level security;

-- Cada usuário autenticado só consegue confirmar se o próprio UUID está na tabela admins.
drop policy if exists "admins_read_self" on public.admins;
create policy "admins_read_self"
on public.admins for select
to authenticated
using (user_id = auth.uid());

-- Formulário público: somente INSERT e somente com os campos administrativos intactos.
drop policy if exists "public_can_submit_interest" on public.investor_leads;
create policy "public_can_submit_interest"
on public.investor_leads for insert
to anon, authenticated
with check (
  lgpd_consent = true
  and admin_status = 'novo'
  and confirmed_amount is null
  and admin_notes is null
);

-- Administradores autorizados podem visualizar todos os cadastros.
drop policy if exists "admins_can_read_leads" on public.investor_leads;
create policy "admins_can_read_leads"
on public.investor_leads for select
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Administradores autorizados podem atualizar o acompanhamento interno.
drop policy if exists "admins_can_update_leads" on public.investor_leads;
create policy "admins_can_update_leads"
on public.investor_leads for update
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Não criamos policies de DELETE de propósito: evita exclusão acidental pelo site.

-- ============================================================
-- DEPOIS DE CRIAR O USUÁRIO ADMIN NO PAINEL AUTHENTICATION > USERS,
-- copie o UUID dele e execute, substituindo os valores:
--
-- insert into public.admins (user_id, email)
-- values ('COLE-O-UUID-AQUI', 'seu-email@dominio.com')
-- on conflict (user_id) do update set email = excluded.email;
-- ============================================================
