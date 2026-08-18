-- =====================================================================
-- EPM — AMIGOS FUNDADORES V2
-- Banco Supabase + segurança RLS + meta pública agregada
-- Data: 2026-08
--
-- Execute TODO este arquivo no SQL Editor do seu projeto Supabase.
-- Ele também tenta migrar com segurança uma instalação da V1.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) ADMINISTRADORES
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) CADASTROS / APOIADORES
-- Mantemos o nome investor_leads para compatibilidade com a V1.
-- ---------------------------------------------------------------------
create table if not exists public.investor_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) <= 160),
  whatsapp text not null check (char_length(whatsapp) <= 24),
  city_state text not null check (char_length(city_state) <= 100),
  profile_type text not null check (char_length(profile_type) <= 80),
  organization_name text check (char_length(organization_name) <= 140),
  support_program text not null default 'Amigo Fundador' check (char_length(support_program) <= 120),
  source text,
  relationship text check (char_length(relationship) <= 500),
  support_types text[] not null default array['Amigo Fundador']::text[] check (cardinality(support_types) >= 1),
  intended_amount numeric(12,2) check (intended_amount is null or intended_amount >= 0),
  payment_preference text,
  motivation text check (char_length(motivation) <= 1000),
  best_contact_period text,
  allow_name_public boolean not null default false,
  lgpd_consent boolean not null default false,
  consent_version text,
  consent_at timestamptz not null default now(),

  admin_status text not null default 'novo',
  confirmed_amount numeric(12,2) check (confirmed_amount is null or confirmed_amount >= 0),
  received_amount numeric(12,2) not null default 0 check (received_amount >= 0),
  received_at timestamptz,
  payment_method_confirmed text,
  credit_used numeric(12,2) not null default 0 check (credit_used >= 0),
  certificate_status text not null default 'nao_emitido',
  certificate_code text check (char_length(certificate_code) <= 80),
  admin_notes text check (char_length(admin_notes) <= 3000)
);

-- Migração V1 -> V2 (não causa erro se as colunas já existirem)
alter table public.investor_leads add column if not exists organization_name text;
alter table public.investor_leads add column if not exists support_program text not null default 'Amigo Fundador';
alter table public.investor_leads add column if not exists consent_version text;
alter table public.investor_leads add column if not exists consent_at timestamptz not null default now();
alter table public.investor_leads add column if not exists received_amount numeric(12,2) not null default 0;
alter table public.investor_leads add column if not exists received_at timestamptz;
alter table public.investor_leads add column if not exists payment_method_confirmed text;
alter table public.investor_leads add column if not exists credit_used numeric(12,2) not null default 0;
alter table public.investor_leads add column if not exists certificate_status text not null default 'nao_emitido';
alter table public.investor_leads add column if not exists certificate_code text;

-- Compatibilidade com a V1: support_types existia como NOT NULL sem default.
alter table public.investor_leads alter column support_types set default array['Amigo Fundador']::text[];

-- Atualiza limites de campos onde a V2 usa tamanhos maiores.
alter table public.investor_leads drop constraint if exists investor_leads_admin_notes_check;
alter table public.investor_leads add constraint investor_leads_admin_notes_check check (admin_notes is null or char_length(admin_notes) <= 3000);

-- Remove a restrição antiga antes de converter status da V1.
alter table public.investor_leads drop constraint if exists investor_leads_admin_status_check;
update public.investor_leads set admin_status = 'contato' where admin_status = 'reuniao';
update public.investor_leads set admin_status = 'recebido' where admin_status = 'pago';

alter table public.investor_leads add constraint investor_leads_admin_status_check
  check (admin_status in ('novo','contato','aguardando','confirmado','recebido_parcial','recebido','pausado','encerrado'));

alter table public.investor_leads drop constraint if exists investor_leads_certificate_status_check;
alter table public.investor_leads add constraint investor_leads_certificate_status_check
  check (certificate_status in ('nao_emitido','emitir','emitido','entregue'));

alter table public.investor_leads drop constraint if exists investor_leads_credit_check;
alter table public.investor_leads add constraint investor_leads_credit_check
  check (credit_used >= 0 and credit_used <= received_amount);

create index if not exists investor_leads_created_at_idx on public.investor_leads(created_at desc);
create index if not exists investor_leads_status_idx on public.investor_leads(admin_status);
create index if not exists investor_leads_received_idx on public.investor_leads(received_amount) where received_amount > 0;

-- ---------------------------------------------------------------------
-- 3) updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_epm_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_epm_updated_at on public.investor_leads;
create trigger trg_epm_updated_at
before update on public.investor_leads
for each row execute function public.set_epm_updated_at();

-- ---------------------------------------------------------------------
-- 4) ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.admins enable row level security;
alter table public.investor_leads enable row level security;

-- Privilégios de tabela: acesso à API existe, mas RLS decide as linhas.
revoke all on table public.admins from anon, authenticated;
grant select on table public.admins to authenticated;

revoke all on table public.investor_leads from anon, authenticated;
grant insert on table public.investor_leads to anon, authenticated;
grant select, update on table public.investor_leads to authenticated;

-- O usuário autenticado só lê a própria linha de autorização.
drop policy if exists "admins_read_self" on public.admins;
create policy "admins_read_self"
on public.admins
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Cadastro público: só aceita registro com os campos internos intactos.
drop policy if exists "public_can_submit_interest" on public.investor_leads;
create policy "public_can_submit_interest"
on public.investor_leads
for insert
to anon, authenticated
with check (
  lgpd_consent = true
  and admin_status = 'novo'
  and confirmed_amount is null
  and received_amount = 0
  and received_at is null
  and payment_method_confirmed is null
  and credit_used = 0
  and certificate_status = 'nao_emitido'
  and certificate_code is null
  and admin_notes is null
);

-- Administradores podem ler todos os cadastros.
drop policy if exists "admins_can_read_leads" on public.investor_leads;
create policy "admins_can_read_leads"
on public.investor_leads
for select
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid())
  )
);

-- Administradores podem atualizar o controle interno.
drop policy if exists "admins_can_update_leads" on public.investor_leads;
create policy "admins_can_update_leads"
on public.investor_leads
for update
to authenticated
using (
  exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.admins a
    where a.user_id = (select auth.uid())
  )
);

-- Não existe policy DELETE: o site não apaga registros.

-- ---------------------------------------------------------------------
-- 5) META PÚBLICA, SEM EXPOR DADOS PESSOAIS
-- A página pública chama apenas esta função agregada.
-- Ela retorna total recebido, número de apoios recebidos e atualização.
-- ---------------------------------------------------------------------
create or replace function public.get_epm_campaign_stats()
returns table (
  goal numeric,
  received numeric,
  supporters bigint,
  percent numeric,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    10000::numeric as goal,
    coalesce(sum(received_amount), 0)::numeric as received,
    count(*) filter (where received_amount > 0)::bigint as supporters,
    case
      when 10000 = 0 then 0::numeric
      else least(100::numeric, round((coalesce(sum(received_amount), 0) / 10000::numeric) * 100, 1))
    end as percent,
    max(coalesce(received_at, updated_at)) filter (where received_amount > 0) as updated_at
  from public.investor_leads;
$$;

revoke all on function public.get_epm_campaign_stats() from public;
grant execute on function public.get_epm_campaign_stats() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) CRIAR O PRIMEIRO ADMIN
-- 1. Supabase Dashboard > Authentication > Users > Add user.
-- 2. Copie o UUID do usuário criado.
-- 3. Rode o comando abaixo substituindo UUID e e-mail:
--
-- insert into public.admins (user_id, email)
-- values ('COLE-O-UUID-AQUI', 'seu-email@dominio.com')
-- on conflict (user_id) do update set email = excluded.email;
--
-- Para adicionar outro administrador, repita o mesmo processo.
-- =====================================================================
