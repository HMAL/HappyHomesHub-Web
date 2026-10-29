-- Every new landlord gets an automatic 3-month free trial on their first
-- subscription. To stop the same person from farming repeated trials with fresh
-- accounts, eligibility is keyed on a fingerprint of their demographics + property
-- address (computed in the checkout function). Once a fingerprint has claimed a
-- trial it can never claim another.

create table if not exists public.trial_redemptions (
  fingerprint text primary key,                         -- normalized name|phone|address
  landlord_id uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.trial_redemptions enable row level security;
-- Service role only (checkout + webhook). No client policies → no client access.

-- The auto-trial replaces the FREE promo code, so retire it. HAPPYHOMEOWNER
-- (first property free forever) stays active — it's a permanent perk, not a trial.
update public.promo_codes set active = false where code = 'FREE';
