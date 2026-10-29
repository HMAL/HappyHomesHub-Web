-- Migration 034: Landlord Stripe Connect accounts (rent flows tenant → landlord)
-- ─────────────────────────────────────────────────────────────────────────────
-- Rent paid by card previously settled into the platform Stripe account and never
-- reached the landlord. We add a Stripe Connect (Express) account per landlord so
-- rent is routed directly to them. Platform takes $0 (flat $10/property/mo only).
--
-- These columns are written only by edge functions using the service role.
-- The client can read its own row (existing users self-select policy) but must not
-- be able to set these, so we add a trigger guard rather than rely on column grants.

alter table public.users
  add column if not exists stripe_connect_account_id text,
  add column if not exists connect_charges_enabled  boolean not null default false,
  add column if not exists connect_payouts_enabled  boolean not null default false;

-- Prevent clients from spoofing their own Connect state. Service-role writes
-- (auth.uid() is null in that context) are allowed through untouched.
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
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_connect_columns on public.users;
create trigger trg_guard_connect_columns
  before update on public.users
  for each row execute function public.guard_connect_columns();
