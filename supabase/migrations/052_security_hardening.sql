-- 052: Security hardening from the 2026-07-05 advisor review.
--
-- 1. SECURITY DEFINER functions: PostgREST exposes every public function to the
--    `anon`/`authenticated` roles via /rest/v1/rpc/* because Postgres grants
--    EXECUTE to PUBLIC by default. Trim each function to the roles that
--    actually call it (client RPC usage audited in src/**).
-- 2. Pin search_path on functions the linter flagged as mutable.
-- 3. error_log: replace the WITH CHECK (true) INSERT policy with an
--    authenticated-only policy. Anonymous visitors' errors still reach Sentry;
--    edge functions write with service_role, which bypasses RLS.

-- ── 1a. Trigger / internal functions: not callable via RPC by anyone ─────────
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_handyman_rating() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_connect_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_payout_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_premium_column() FROM PUBLIC, anon, authenticated;

-- ── 1b. Service-role-only RPCs (called from edge functions) ──────────────────
REVOKE ALL ON FUNCTION public.increment_promo_usage(p_code text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_promo_usage(p_code text) TO service_role;

REVOKE ALL ON FUNCTION public.qualify_referral(p_referee uuid, p_kind text, p_amount integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qualify_referral(p_referee uuid, p_kind text, p_amount integer) TO service_role;

-- ── 1c. Signed-in-only RPCs: drop anon, keep authenticated + service_role ────
REVOKE ALL ON FUNCTION public.accept_invite(p_token text, p_user_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(p_token text, p_user_id uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.redeem_referral(p_code text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_referral(p_code text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_or_create_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.qualify_landlord_referral() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qualify_landlord_referral() TO authenticated, service_role;

-- ── 1d. RLS helper functions: policies evaluate them as the querying role, so
--        authenticated must keep EXECUTE; anon never touches these tables ─────
REVOKE ALL ON FUNCTION public.fn_tenant_property_ids(tenant_uid uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_tenant_property_ids(tenant_uid uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_landlord_tenant_ids(landlord_uid uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_landlord_tenant_ids(landlord_uid uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_tenant_landlord_ids(tenant_uid uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_tenant_landlord_ids(tenant_uid uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_has_tenancy_access(tid uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_has_tenancy_access(tid uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_is_landlord_of_property(prop_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_is_landlord_of_property(prop_id uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_handyman_has_job_at_property(prop_id uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_handyman_has_job_at_property(prop_id uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_handyman_has_job_in_tenancy(tid uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_handyman_has_job_in_tenancy(tid uuid) TO authenticated, service_role;

-- get_invite_preview intentionally stays anon-executable: the /join page shows
-- invite details before the visitor has an account, and the token is unguessable.

-- ── 2. Pin search_path (linter: function_search_path_mutable) ────────────────
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.handle_new_user_role() SET search_path = public;
ALTER FUNCTION public.fn_tenant_property_ids(tenant_uid uuid) SET search_path = public;
ALTER FUNCTION public.fn_landlord_tenant_ids(landlord_uid uuid) SET search_path = public;
ALTER FUNCTION public.fn_tenant_landlord_ids(tenant_uid uuid) SET search_path = public;
ALTER FUNCTION public.sync_handyman_rating() SET search_path = public;

-- ── 3. error_log: authenticated-only inserts, row must belong to the caller ──
DROP POLICY IF EXISTS error_log_insert_any ON public.error_log;
CREATE POLICY error_log_insert_own ON public.error_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
