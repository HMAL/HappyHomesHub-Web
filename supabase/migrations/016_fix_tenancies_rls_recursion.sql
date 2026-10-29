-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub | Migration 016 — Fix tenancies RLS infinite recursion
--
-- Root cause introduced in migration 014:
--   "handyman can view assigned property" on properties JOINs tenancies.
--   tenancies_landlord (FOR ALL) queries properties to verify landlord_id.
--   Postgres evaluates ALL permissive properties policies, including the 014 one,
--   which joins tenancies again → infinite recursion.
--
-- The chain:
--   tenancies_landlord  →  SELECT FROM properties
--                       →  properties RLS fires
--                       →  "handyman can view assigned property" JOINs tenancies
--                       →  tenancies RLS fires → tenancies_landlord → loop!
--
-- Fix: replace the inline properties subquery in tenancies_landlord with a
-- SECURITY DEFINER helper that bypasses properties RLS, breaking the cycle.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. SECURITY DEFINER helper — checks landlord ownership without triggering RLS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_is_landlord_of_property(prop_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM properties WHERE id = prop_id AND landlord_id = auth.uid()
  );
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Rewrite tenancies_landlord to use the SECURITY DEFINER helper
--    The semantic is identical: landlord can do anything with their tenancies.
--    The difference: properties lookup bypasses properties RLS, stopping the loop.
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "tenancies_landlord" ON public.tenancies;

CREATE POLICY "tenancies_landlord" ON public.tenancies
  FOR ALL
  USING     (public.fn_is_landlord_of_property(property_id))
  WITH CHECK (public.fn_is_landlord_of_property(property_id));


-- ══════════════════════════════════════════════════════════════════════════════
-- Done. Run in Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════════════════
