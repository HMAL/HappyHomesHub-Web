-- Migration 036: Notification channels + Premium flag
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds:
--   1. is_premium on users — gates premium-only benefits (SMS notifications now;
--      Epic 5 wires the actual upgrade purchase to flip this).
--   2. notification_prefs — per-user channel opt-ins (push / sms / email).
--   3. push_subscriptions — Web Push endpoints (free for all users).
--
-- is_premium is written only by edge functions (service role); the guard trigger
-- below prevents a client from granting itself Premium.

alter table public.users
  add column if not exists is_premium boolean not null default false;

create or replace function public.guard_premium_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.is_premium := old.is_premium;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_premium_column on public.users;
create trigger trg_guard_premium_column
  before update on public.users
  for each row execute function public.guard_premium_column();

-- ── Per-user notification channel preferences ────────────────────────────────
create table if not exists public.notification_prefs (
  user_id     uuid primary key references public.users(id) on delete cascade,
  push_enabled boolean not null default true,
  sms_enabled  boolean not null default false,  -- premium only; off by default
  email_enabled boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

drop policy if exists "prefs_self" on public.notification_prefs;
create policy "prefs_self" on public.notification_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Web Push subscriptions ───────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subs_self" on public.push_subscriptions;
create policy "push_subs_self" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);
