-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 003 — Web Additions
--
-- Run this ONLY if you already applied the mobile app's 001 + 002 migrations.
-- It patches the existing schema with everything the web app needs.
-- Safe to re-run (idempotent).
--
-- SKIP this file if you ran 001_initial.sql from the web project — already
-- included there.
--
-- What it does:
--   1. Adds 'handyman' to role_assignments.role CHECK
--   2. Adds 'global' to role_assignments.context_type CHECK
--   3. Adds handyman_id column to maintenance_requests
--   4. Adds 'assigned' to maintenance_requests.status CHECK
--   5. Adds 'assigned' to maintenance_updates.status_change CHECK
--   6. Adds receiver_id column to messages
--   7. Creates handyman_profiles table
--   8. Adds property_count + amount_per_property to subscriptions
--   9. Makes stripe columns + current_period_end nullable in subscriptions
--  10. Updates RLS policies for handyman access
--  11. Adds missing indexes
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. role_assignments — add 'handyman' role + 'global' context_type
-- ══════════════════════════════════════════════════════════════════════════════

-- Drop the old role check (mobile only had landlord/tenant)
alter table public.role_assignments
  drop constraint if exists role_assignments_role_check;

alter table public.role_assignments
  add constraint role_assignments_role_check
    check (role in ('landlord', 'tenant', 'handyman'));

-- Drop the old context_type check (mobile only had property/tenancy)
alter table public.role_assignments
  drop constraint if exists role_assignments_context_type_check;

alter table public.role_assignments
  add constraint role_assignments_context_type_check
    check (context_type in ('property', 'tenancy', 'global'));


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. maintenance_requests — add handyman_id + 'assigned' status
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.maintenance_requests
  add column if not exists handyman_id uuid references public.users(id);

-- Drop old status check (mobile was missing 'assigned')
alter table public.maintenance_requests
  drop constraint if exists maintenance_requests_status_check;

alter table public.maintenance_requests
  add constraint maintenance_requests_status_check
    check (status in ('open', 'assigned', 'in_progress', 'resolved', 'closed'));

create index if not exists idx_maintenance_handyman
  on public.maintenance_requests(handyman_id);

create index if not exists idx_maintenance_status
  on public.maintenance_requests(status);


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. maintenance_updates — add 'assigned' to status_change CHECK
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.maintenance_updates
  drop constraint if exists maintenance_updates_status_change_check;

alter table public.maintenance_updates
  add constraint maintenance_updates_status_change_check
    check (status_change in ('open', 'assigned', 'in_progress', 'resolved', 'closed'));


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. messages — add receiver_id (used by handyman → landlord direct messages)
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.messages
  add column if not exists receiver_id uuid references public.users(id);

create index if not exists idx_messages_receiver
  on public.messages(receiver_id);

create index if not exists idx_messages_sender
  on public.messages(sender_id);

-- Update messages RLS to allow handyman access via sender_id / receiver_id.
-- The mobile policy only checked the tenancy landlord/tenant chain, which
-- blocks handymen who are neither.
drop policy if exists "messages_access" on public.messages;
create policy "messages_access" on public.messages
  for all using (
    sender_id = auth.uid()
    or receiver_id = auth.uid()
    or exists (
      select 1 from public.tenancies t
      join public.properties p on p.id = t.property_id
      where t.id = tenancy_id
        and (t.tenant_id = auth.uid() or p.landlord_id = auth.uid())
    )
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. handyman_profiles — new table (not in mobile schema at all)
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists public.handyman_profiles (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null unique references public.users(id) on delete cascade,
  skills         text[] not null default '{}',
  availability   text[] not null default '{}',
  service_area   text,
  service_phone  text,
  hourly_rate    numeric(8,2),
  bio            text,
  is_available   boolean not null default true,
  verified       boolean not null default false,
  completed_jobs integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace trigger set_updated_at
  before update on public.handyman_profiles
  for each row execute procedure public.set_updated_at();

alter table public.handyman_profiles enable row level security;

drop policy if exists "handyman_profiles_own" on public.handyman_profiles;
create policy "handyman_profiles_own" on public.handyman_profiles
  for all using (user_id = auth.uid());

drop policy if exists "handyman_profiles_public_read" on public.handyman_profiles;
create policy "handyman_profiles_public_read" on public.handyman_profiles
  for select using (auth.uid() is not null);

create index if not exists idx_handyman_profiles_user
  on public.handyman_profiles(user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 6. subscriptions — add per-property pricing columns; relax NOT NULL
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.subscriptions
  add column if not exists property_count integer not null default 1;

alter table public.subscriptions
  add column if not exists amount_per_property numeric(8,2) not null default 10;

-- Mobile made these NOT NULL but free-tier users won't have Stripe IDs
alter table public.subscriptions
  alter column stripe_customer_id drop not null;

alter table public.subscriptions
  alter column stripe_subscription_id drop not null;

alter table public.subscriptions
  alter column current_period_end drop not null;


-- ══════════════════════════════════════════════════════════════════════════════
-- 7. RLS — handyman policies on maintenance_requests
-- ══════════════════════════════════════════════════════════════════════════════

-- Mobile only had landlord+tenant on maintenance_requests.
-- Add a SELECT policy so handymen can browse open jobs and see their own.
drop policy if exists "maintenance_handyman_view" on public.maintenance_requests;
create policy "maintenance_handyman_view" on public.maintenance_requests
  for select using (
    status = 'open'               -- any authenticated user can browse open jobs
    or handyman_id = auth.uid()   -- see own assigned/active/completed jobs
  );

-- Allow handymen to accept open jobs (set handyman_id + status = in_progress)
drop policy if exists "maintenance_handyman_accept" on public.maintenance_requests;
create policy "maintenance_handyman_accept" on public.maintenance_requests
  for update using (
    (status = 'open' and handyman_id is null)  -- claim unassigned job
    or handyman_id = auth.uid()                 -- update own job
  );

-- Allow handymen to insert status updates on their own jobs
drop policy if exists "maintenance_updates_insert_handyman" on public.maintenance_updates;
create policy "maintenance_updates_insert_handyman" on public.maintenance_updates
  for insert with check (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════
-- 8. users — allow landlords/tenants to read handyman user rows
--    (needed to show handyman name on job cards)
-- ══════════════════════════════════════════════════════════════════════════════

drop policy if exists "anyone_can_read_handymen" on public.users;
create policy "anyone_can_read_handymen" on public.users
  for select using (
    exists (
      select 1 from public.handyman_profiles where user_id = users.id
    )
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- Done — run in Supabase SQL Editor to apply.
-- ══════════════════════════════════════════════════════════════════════════════
