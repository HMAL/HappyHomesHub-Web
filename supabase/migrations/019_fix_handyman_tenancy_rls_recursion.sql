-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub | Migration 019 — Fix remaining tenancies RLS recursion
--
-- After 016 + 017 + 018 the only remaining cycle source on the tenancies table
-- is the "handyman can view assigned tenancy" policy (migration 014), which
-- queries maintenance_requests directly.  That query triggers
-- maintenance_requests RLS, which can chain back to tenancies via other policies.
--
-- Fix: Replace the inline subquery with a SECURITY DEFINER helper that bypasses
-- maintenance_requests RLS entirely, so no policy on tenancies can ever
-- indirectly re-enter tenancies RLS.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Helper: does auth.uid() have a job assigned inside this tenancy?
--    SECURITY DEFINER bypasses maintenance_requests RLS — no chain back to tenancies.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_handyman_has_job_in_tenancy(tid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM maintenance_requests
    WHERE tenancy_id = tid
      AND handyman_id = auth.uid()
  );
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Rewrite "handyman can view assigned tenancy" to use the helper.
--    Semantics unchanged: handyman can read tenancies where they have a job.
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "handyman can view assigned tenancy" ON public.tenancies;

CREATE POLICY "handyman can view assigned tenancy" ON public.tenancies
  FOR SELECT TO authenticated
  USING (public.fn_handyman_has_job_in_tenancy(id));


-- ══════════════════════════════════════════════════════════════════════════════
-- Done. Run in Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════════════════
