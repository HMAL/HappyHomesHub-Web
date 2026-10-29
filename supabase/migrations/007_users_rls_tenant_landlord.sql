-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 007 — Allow tenants to read landlord profiles
--
-- Problem: tenants see '?' instead of landlord name in maintenance update feeds
-- because the users table has no RLS policy letting a tenant read their landlord's row.
-- The existing landlord_can_read_tenants policy goes the other way only.
--
-- Fix: add a SECURITY DEFINER helper (same pattern as migration 005) and a new
-- select policy so the Supabase join in maintenance_updates queries resolves the
-- landlord's full_name correctly for the tenant's request.
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Helper: landlord IDs visible to a given tenant ─────────────────────────
--    Uses SECURITY DEFINER to bypass RLS on tenancies/properties, breaking the
--    potential recursive-policy cycle.

create or replace function public.fn_tenant_landlord_ids(tenant_uid uuid)
returns setof uuid
language sql
security definer
stable
as $$
  select p.landlord_id
  from public.tenancies t
  join public.properties p on p.id = t.property_id
  where t.tenant_id = tenant_uid
$$;


-- ── 2. New policy: tenant can read their own landlord's user row ───────────────

drop policy if exists "tenant_can_read_landlord" on public.users;
create policy "tenant_can_read_landlord" on public.users
  for select using (
    id = any(select public.fn_tenant_landlord_ids(auth.uid()))
  );


-- ── Done ─────────────────────────────────────────────────────────────────────
-- After running this, the maintenance_updates join user:user_id(full_name)
-- will correctly resolve the landlord's name for tenants viewing their repairs.
