-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 005 — Fix RLS infinite recursion
--
-- The cycle that caused "infinite recursion detected in policy for relation tenancies":
--   users (landlord_can_read_tenants) → tenancies
--   tenancies (tenancies_landlord)    → properties
--   properties (properties_tenant_view) → tenancies   ← cycle!
--
-- Fix: wrap the subqueries in SECURITY DEFINER functions so they bypass RLS,
-- breaking the circular reference.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Helper: property IDs for a given tenant (bypasses RLS on tenancies)
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function public.fn_tenant_property_ids(tenant_uid uuid)
returns setof uuid language sql security definer stable as $$
  select property_id from public.tenancies where tenant_id = tenant_uid
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Helper: tenant IDs visible to a given landlord (bypasses RLS)
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function public.fn_landlord_tenant_ids(landlord_uid uuid)
returns setof uuid language sql security definer stable as $$
  select t.tenant_id
  from public.tenancies t
  join public.properties p on p.id = t.property_id
  where p.landlord_id = landlord_uid and t.tenant_id is not null
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Rewrite properties_tenant_view — no longer references tenancies directly
-- ══════════════════════════════════════════════════════════════════════════════

drop policy if exists "properties_tenant_view" on public.properties;
create policy "properties_tenant_view" on public.properties
  for select using (
    id = any(select public.fn_tenant_property_ids(auth.uid()))
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. Rewrite landlord_can_read_tenants — no longer references tenancies directly
-- ══════════════════════════════════════════════════════════════════════════════

drop policy if exists "landlord_can_read_tenants" on public.users;
create policy "landlord_can_read_tenants" on public.users
  for select using (
    id = any(select public.fn_landlord_tenant_ids(auth.uid()))
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. Fix properties INSERT policy — add explicit WITH CHECK so inserts are allowed
--    (FOR ALL USING only covers existing-row checks; inserts need WITH CHECK)
-- ══════════════════════════════════════════════════════════════════════════════

drop policy if exists "properties_landlord" on public.properties;
create policy "properties_landlord" on public.properties
  for all
  using     (landlord_id = auth.uid())
  with check (landlord_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════════
-- Done — run in Supabase SQL Editor to apply.
-- ══════════════════════════════════════════════════════════════════════════════
