-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub | Migration 017 — Fix maintenance_requests RLS recursion
--
-- Cycle B (016 did not cover this):
--   tenancies  ("handyman can view assigned tenancy") → maintenance_requests
--   maintenance_requests (maintenance_landlord_tenant) → JOIN tenancies
--   tenancies RLS fires → "handyman can view assigned tenancy" → loop!
--
-- Fix: replace the inline tenancies/properties JOIN in maintenance_landlord_tenant
-- with a SECURITY DEFINER helper that bypasses both tenancies and properties RLS,
-- breaking the circular reference.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Helper: tenant-or-landlord check for a tenancy (bypasses tenancies + properties RLS)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_has_tenancy_access(tid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenancies t
    JOIN properties p ON p.id = t.property_id
    WHERE t.id = tid
      AND (t.tenant_id = auth.uid() OR p.landlord_id = auth.uid())
  );
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Rewrite maintenance_landlord_tenant to use the helper
--    Semantics unchanged: tenant or landlord of the linked tenancy can access.
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "maintenance_landlord_tenant" ON public.maintenance_requests;

CREATE POLICY "maintenance_landlord_tenant" ON public.maintenance_requests
  FOR ALL
  USING     (public.fn_has_tenancy_access(tenancy_id))
  WITH CHECK (public.fn_has_tenancy_access(tenancy_id));


-- ══════════════════════════════════════════════════════════════════════════════
-- Done. Run in Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════════════════
