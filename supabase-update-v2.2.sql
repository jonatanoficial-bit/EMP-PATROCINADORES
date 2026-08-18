-- EPM Patrocinadores V2.2 — aceite do Termo e marketing opcional
alter table public.investor_leads
  add column if not exists terms_accepted boolean not null default false;

alter table public.investor_leads
  add column if not exists terms_version text;

alter table public.investor_leads
  add column if not exists marketing_opt_in boolean not null default false;

drop policy if exists "public_can_submit_interest" on public.investor_leads;

create policy "public_can_submit_interest"
on public.investor_leads
for insert
to anon, authenticated
with check (
  lgpd_consent = true
  and terms_accepted = true
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
