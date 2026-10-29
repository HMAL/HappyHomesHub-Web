-- Migration 053: 1-to-1 payments — ACH bank debits + saved payment methods
-- ─────────────────────────────────────────────────────────────────────────────
-- Rent (tenant → landlord) and handyman payments (landlord → handyman) are
-- direct charges on the recipient's Connect account; the platform never holds
-- funds. This migration adds what card-only Checkout didn't need:
--
--   1. payment_method constraint fix — the webhook records 'card' but the 002
--      check constraint never allowed it, so the "mark rent paid" UPDATE was
--      silently violating the constraint. Allow 'card' and 'ach'.
--   2. 'processing' status — ACH debits settle in ~4 business days, so a
--      payment can be initiated but not yet settled.
--   3. users.connect_ach_enabled — whether the recipient's connected account
--      has the us_bank_account_ach_payments capability active (synced from the
--      account.updated webhook, same as the other connect_* flags).
--   4. stripe_customers — with direct charges, Stripe Customers live on each
--      connected account (not the platform), so a payer needs one Customer per
--      recipient account to save/reuse payment methods in Checkout.

-- 1. Allow 'card' (what the webhook already writes) and 'ach' on rent payments.
alter table public.rent_payments
  drop constraint if exists rent_payments_payment_method_check;
alter table public.rent_payments
  add constraint rent_payments_payment_method_check
  check (payment_method in ('stripe','card','ach','check','cash','bank_transfer','money_order','other'));

-- 2a. Rent payments can be in-flight while an ACH debit settles.
alter table public.rent_payments
  drop constraint if exists rent_payments_status_check;
alter table public.rent_payments
  add constraint rent_payments_status_check
  check (status in ('pending','processing','paid','late','waived','partial'));

-- 2b. Same for handyman payouts on maintenance requests.
alter table public.maintenance_requests
  drop constraint if exists maintenance_requests_payout_status_check;
alter table public.maintenance_requests
  add constraint maintenance_requests_payout_status_check
  check (payout_status in ('none','pending','processing','paid'));

-- 3. ACH capability flag, written only by the webhook (service role).
alter table public.users
  add column if not exists connect_ach_enabled boolean not null default false;

-- Extend the existing anti-spoofing guard (034) to freeze the new column too.
create or replace function public.guard_connect_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    -- a normal authenticated client update: freeze the Connect columns
    new.stripe_connect_account_id := old.stripe_connect_account_id;
    new.connect_charges_enabled   := old.connect_charges_enabled;
    new.connect_payouts_enabled   := old.connect_payouts_enabled;
    new.connect_ach_enabled       := old.connect_ach_enabled;
  end if;
  return new;
end;
$$;

-- 4. Payer → per-connected-account Stripe Customer mapping. Written and read
-- only by edge functions with the service role; RLS is enabled with no
-- policies so clients can't touch it at all.
create table if not exists public.stripe_customers (
  user_id            uuid not null references public.users(id) on delete cascade,
  connect_account_id text not null,
  stripe_customer_id text not null,
  created_at         timestamptz not null default now(),
  primary key (user_id, connect_account_id)
);

alter table public.stripe_customers enable row level security;
