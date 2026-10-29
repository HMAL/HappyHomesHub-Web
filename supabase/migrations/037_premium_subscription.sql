-- Migration 037: Track the Premium ("Real" tier) subscription per user.
-- ─────────────────────────────────────────────────────────────────────────────
-- Premium = Basic + SMS notifications. The webhook flips users.is_premium based on
-- this subscription's lifecycle. Column written only by the service role (the
-- is_premium guard trigger from 036 already blocks client tampering of is_premium;
-- this id column is likewise only set server-side).

alter table public.users
  add column if not exists stripe_premium_subscription_id text;
