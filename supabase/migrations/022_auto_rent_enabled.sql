-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 022 — Auto-rent generation toggle
--
-- Adds auto_rent_enabled to tenancies. When true, the generate-monthly-rent
-- Edge Function will auto-create a pending rent_payment record on the 1st of
-- each month so landlords don't have to do it manually.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.tenancies
  add column if not exists auto_rent_enabled boolean not null default false;
