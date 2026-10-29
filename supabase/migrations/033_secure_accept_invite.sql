-- Migration 033: Harden accept_invite — derive the tenant from the verified
-- session, never from a client-supplied argument.
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem: accept_invite(p_token, p_user_id) is SECURITY DEFINER and was binding
-- tenancies to whatever p_user_id the caller passed. Any authenticated user could
-- call it with an arbitrary user_id (and, with a known token, claim a tenancy for
-- someone else or for themselves). auth.uid() resolves from the request JWT even
-- inside SECURITY DEFINER, so we use it as the source of truth and ignore the
-- supplied p_user_id. Signature is kept for client compatibility (no client change
-- required); the argument is now inert.

CREATE OR REPLACE FUNCTION public.accept_invite(p_token text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id, tenancy_id
  INTO v_invite
  FROM public.invites
  WHERE token = p_token AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invite not found or already used');
  END IF;

  -- Link the authenticated tenant; keep pending_invite until landlord approves.
  UPDATE public.tenancies
  SET
    tenant_id  = v_uid,
    status     = 'pending_invite',
    updated_by = v_uid,
    updated_at = now()
  WHERE id = v_invite.tenancy_id;

  UPDATE public.invites
  SET
    status     = 'accepted',
    updated_by = v_uid,
    updated_at = now()
  WHERE id = v_invite.id;

  INSERT INTO public.role_assignments
    (user_id, role, context_id, context_type, created_by, updated_by)
  VALUES
    (v_uid, 'tenant', v_uid, 'global', v_uid, v_uid)
  ON CONFLICT (user_id, role, context_id) DO NOTHING;

  RETURN json_build_object('success', true, 'tenancy_id', v_invite.tenancy_id);
END;
$$;
