-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub | Migration 018 — Fix "handyman can view assigned property" recursion
--
-- Cycle C (016 + 017 did not cover this):
--   tenancies ("handyman can view assigned tenancy")
--     → maintenance_requests
--     → maintenance_handyman_view (003) → JOIN properties (via favorite_handymen)
--     → properties RLS
--     → "handyman can view assigned property" (014) → JOIN tenancies
--     → tenancies RLS → LOOP!
--
-- Root cause: "handyman can view assigned property" on properties JOINs tenancies,
-- which triggers tenancies RLS, which triggers maintenance_requests RLS, which
-- triggers properties RLS again.
--
-- Fix: Replace the inline JOIN in "handyman can view assigned property" with a
-- SECURITY DEFINER function that bypasses both maintenance_requests and tenancies
-- RLS, cutting the chain.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Helper: does auth.uid() have an assigned job at this property?
--    SECURITY DEFINER bypasses maintenance_requests + tenancies RLS entirely.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_handyman_has_job_at_property(prop_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM maintenance_requests mr
    JOIN tenancies t ON t.id = mr.tenancy_id
    WHERE t.property_id = prop_id
      AND mr.handyman_id = auth.uid()
  );
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Rewrite "handyman can view assigned property" to use the helper
--    Semantics unchanged: handyman can SELECT properties where they have a job.
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "handyman can view assigned property" ON public.properties;

CREATE POLICY "handyman can view assigned property" ON public.properties
  FOR SELECT TO authenticated
  USING (public.fn_handyman_has_job_at_property(id));


-- ══════════════════════════════════════════════════════════════════════════════
-- Done. Run in Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════════════════
