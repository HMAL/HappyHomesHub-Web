-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 008 — Add business_name + working_hours
--
-- Changes:
--   1. Add business_name (optional) to users table — for both landlords and
--      handymen who operate under a business rather than personal name.
--   2. Add working_hours (optional) to handyman_profiles — lets handymen share
--      their schedule (e.g. "Mon–Fri 8am–6pm, weekends by appointment").
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.users
  add column if not exists business_name text;

alter table public.handyman_profiles
  add column if not exists working_hours text;
