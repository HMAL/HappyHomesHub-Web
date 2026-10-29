-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 010 — Favorite Handymen + Quote System
--
-- 1. favorite_handymen: landlords can bookmark handymen for quick assignment
-- 2. quotes: handymen submit price quotes; landlords accept or decline
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. favorite_handymen
-- ══════════════════════════════════════════════════════════════════════════════
create table if not exists public.favorite_handymen (
  id          uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.users(id) on delete cascade,
  handyman_id uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(landlord_id, handyman_id)
);

alter table public.favorite_handymen enable row level security;

drop policy if exists "landlords manage their favorites" on public.favorite_handymen;
create policy "landlords manage their favorites" on public.favorite_handymen
  for all using (landlord_id = auth.uid());

create index if not exists idx_fav_handymen_landlord on public.favorite_handymen(landlord_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. quotes
-- ══════════════════════════════════════════════════════════════════════════════
create table if not exists public.quotes (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null references public.maintenance_requests(id) on delete cascade,
  handyman_id   uuid not null references public.users(id) on delete cascade,
  amount        numeric(10,2) not null check (amount >= 0),
  description   text,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined')),
  landlord_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.quotes enable row level security;

-- Handyman: full access to their own quotes
drop policy if exists "handyman manages own quotes" on public.quotes;
create policy "handyman manages own quotes" on public.quotes
  for all using (handyman_id = auth.uid());

-- Landlord: read quotes for maintenance requests on their properties
drop policy if exists "landlord reads quotes on their requests" on public.quotes;
create policy "landlord reads quotes on their requests" on public.quotes
  for select using (
    request_id in (
      select mr.id
      from   public.maintenance_requests mr
      join   public.tenancies t  on t.id  = mr.tenancy_id
      join   public.properties p on p.id  = t.property_id
      where  p.landlord_id = auth.uid()
    )
  );

-- Landlord: update (accept/decline) quotes on their requests
drop policy if exists "landlord updates quotes on their requests" on public.quotes;
create policy "landlord updates quotes on their requests" on public.quotes
  for update using (
    request_id in (
      select mr.id
      from   public.maintenance_requests mr
      join   public.tenancies t  on t.id  = mr.tenancy_id
      join   public.properties p on p.id  = t.property_id
      where  p.landlord_id = auth.uid()
    )
  );

create index if not exists idx_quotes_request  on public.quotes(request_id);
create index if not exists idx_quotes_handyman on public.quotes(handyman_id);
