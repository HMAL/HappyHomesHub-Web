-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub | Migration 020 — Application-gated tenancy activation
--
-- Previously: accept_invite immediately set tenancy.status = 'active',
-- marking the property Occupied before any screening.
--
-- New flow:
--   1. Tenant accepts invite → tenancy.status stays 'pending_invite', tenant_id set
--   2. Landlord reviews rental application
--   3. Landlord approves → application.status = 'approved' AND tenancy.status = 'active'
--   4. Property shows "Occupied" only after step 3
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Update accept_invite to keep tenancy as pending_invite
--    (was: status = 'active', now: status = 'pending_invite')
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.accept_invite(p_token text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
BEGIN
  SELECT id, tenancy_id
  INTO v_invite
  FROM public.invites
  WHERE token = p_token AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invite not found or already used');
  END IF;

  -- Link the tenant but keep pending_invite — landlord approves application to activate
  UPDATE public.tenancies
  SET
    tenant_id  = p_user_id,
    status     = 'pending_invite',
    updated_by = p_user_id,
    updated_at = now()
  WHERE id = v_invite.tenancy_id;

  UPDATE public.invites
  SET
    status     = 'accepted',
    updated_by = p_user_id,
    updated_at = now()
  WHERE id = v_invite.id;

  INSERT INTO public.role_assignments
    (user_id, role, context_id, context_type, created_by, updated_by)
  VALUES
    (p_user_id, 'tenant', p_user_id, 'global', p_user_id, p_user_id)
  ON CONFLICT (user_id, role, context_id) DO NOTHING;

  RETURN json_build_object('success', true, 'tenancy_id', v_invite.tenancy_id);
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Update the RLS fallback policy to match the new status
--    WITH CHECK now allows pending_invite (not active) after tenant claims it
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "tenancies_accept_invite" ON public.tenancies;

CREATE POLICY "tenancies_accept_invite" ON public.tenancies
  FOR UPDATE TO authenticated
  USING (
    status = 'pending_invite'
    AND tenant_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.invites
      WHERE tenancy_id = tenancies.id AND status = 'pending'
    )
  )
  WITH CHECK (
    tenant_id = auth.uid()
    AND status = 'pending_invite'
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- Done. Run in Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════════════════
