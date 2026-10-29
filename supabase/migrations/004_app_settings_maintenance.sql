-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 004 — app_settings maintenance columns
--
-- Creates app_settings table if it does not already exist, then adds the three
-- maintenance columns (idempotent — safe to re-run).
--
-- Columns added:
--   maintenance_flag  boolean  true  = site is LIVE, false = under maintenance
--   maintenance_time  time              time-of-day when maintenance ends today
--   maintenance_text  text              message shown on the maintenance banner
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Ensure table exists (key/value base structure kept for backward compat)
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.app_settings (
  id         uuid primary key default uuid_generate_v4(),
  key        text unique not null,
  value      jsonb,
  updated_at timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Add columns (skip silently if already present)
--    updated_at must be added explicitly in case the table pre-existed without it.
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.app_settings
  add column if not exists updated_at timestamptz not null default now();

alter table public.app_settings
  add column if not exists maintenance_flag boolean not null default true;

alter table public.app_settings
  add column if not exists maintenance_time time;

alter table public.app_settings
  add column if not exists maintenance_text text;


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Seed the maintenance row if it is missing
-- ══════════════════════════════════════════════════════════════════════════════

insert into public.app_settings (key, maintenance_flag, maintenance_time, maintenance_text)
values (
  'maintenance',
  true,           -- true = site is live (no maintenance)
  null,           -- set a TIME value (e.g. '19:00') when scheduling maintenance
  null            -- set a custom message; null falls back to the default banner text
)
on conflict (key) do nothing;


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. updated_at trigger
-- ══════════════════════════════════════════════════════════════════════════════

create or replace trigger set_updated_at
  before update on public.app_settings
  for each row execute procedure public.set_updated_at();


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. RLS — only service-role / superuser can write; anyone can read
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_public_read" on public.app_settings;
create policy "app_settings_public_read" on public.app_settings
  for select using (true);

-- Writes are intentionally blocked for normal authenticated users.
-- Use the Supabase dashboard (service role) to update settings.


-- ══════════════════════════════════════════════════════════════════════════════
-- Done — run in Supabase SQL Editor to apply.
-- ══════════════════════════════════════════════════════════════════════════════
