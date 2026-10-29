-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 021 — Stripe session ID on rent_payments
--
-- Adds stripe_session_id so the pay-rent Edge Function can link a Stripe
-- Checkout session back to a rent_payment row when the webhook fires.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.rent_payments
  add column if not exists stripe_session_id text;

create index if not exists idx_rent_payments_stripe_session
  on public.rent_payments(stripe_session_id)
  where stripe_session_id is not null;
