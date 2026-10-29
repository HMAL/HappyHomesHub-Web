-- Owner-managed promo codes for landlord property billing.
-- Codes carry a usage quota (max_uses / used_count) and optional expiry so the UI
-- can show live scarcity ("only X left"). used_count is incremented by the Stripe
-- webhook on a *successful* subscription, not at validation, so abandoned
-- checkouts don't burn a code.

create table if not exists public.promo_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  description   text,
  discount_type text not null default 'first_property_free'
    check (discount_type in ('first_property_free', 'percent', 'free_months', 'fixed')),
  discount_value numeric(10,2),               -- percent, months, or $ amount; null for first_property_free
  max_uses      integer not null,
  used_count    integer not null default 0,
  expires_at    timestamptz,                  -- null = no expiry
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.promo_codes enable row level security;

-- Anyone authenticated can READ live codes (powers the on-screen scarcity counter).
-- Writes are service-role only (checkout + webhook); no client insert/update.
drop policy if exists "promo_codes_read_live" on public.promo_codes;
create policy "promo_codes_read_live" on public.promo_codes
  for select using (active = true and (expires_at is null or expires_at > now()));

-- Track which promo (if any) a landlord redeemed, and how many property units it frees.
alter table public.subscriptions
  add column if not exists promo_code          text,
  add column if not exists free_property_units integer not null default 0;

-- Atomic redemption counter, called by the Stripe webhook (service role) only on
-- a successful subscription. SECURITY DEFINER so it runs regardless of the caller's
-- RLS; guarded to never exceed max_uses.
create or replace function public.increment_promo_usage(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.promo_codes
     set used_count = used_count + 1
   where code = p_code
     and used_count < max_uses;
$$;

-- Seed launch promo: first property free forever, 100 redemptions.
insert into public.promo_codes (code, description, discount_type, max_uses)
values (
  'HAPPYHOMEOWNER',
  'First property free forever — limited launch offer.',
  'first_property_free',
  100
)
on conflict (code) do nothing;
