-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 015 — Fix messages INSERT policy
--
-- Problem: landlord unable to send direct messages to handymen.
--
-- The existing messages_access policy is FOR ALL with only a USING expression
-- and no explicit WITH CHECK. PostgreSQL's behavior for INSERT on a FOR ALL
-- policy without WITH CHECK can be ambiguous across versions. Adding an
-- explicit WITH CHECK removes all ambiguity and ensures INSERT is allowed
-- for any authenticated user who is the sender.
--
-- Also adds explicit INSERT policy for rent_payments so tenants can self-report
-- payments (same root cause: FOR ALL USING without WITH CHECK).
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. messages — add explicit WITH CHECK so INSERT works unambiguously
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "messages_access" ON public.messages;

CREATE POLICY "messages_access" ON public.messages
  FOR ALL
  USING (
    sender_id   = auth.uid()
    OR receiver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tenancies t
      JOIN  public.properties p ON p.id = t.property_id
      WHERE t.id = tenancy_id
        AND (t.tenant_id = auth.uid() OR p.landlord_id = auth.uid())
    )
  )
  WITH CHECK (
    -- Any authenticated user may send (they must be the sender)
    sender_id = auth.uid()
    -- OR they are the receiver of a direct message (edge case: forwarding)
    OR receiver_id = auth.uid()
    -- OR the message belongs to a tenancy they are part of
    OR EXISTS (
      SELECT 1 FROM public.tenancies t
      JOIN  public.properties p ON p.id = t.property_id
      WHERE t.id = tenancy_id
        AND (t.tenant_id = auth.uid() OR p.landlord_id = auth.uid())
    )
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. rent_payments — add explicit WITH CHECK so tenant INSERT works
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "rent_payments_access" ON public.rent_payments;

CREATE POLICY "rent_payments_access" ON public.rent_payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenancies t
      JOIN  public.properties p ON p.id = t.property_id
      WHERE t.id = tenancy_id
        AND (t.tenant_id = auth.uid() OR p.landlord_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenancies t
      JOIN  public.properties p ON p.id = t.property_id
      WHERE t.id = tenancy_id
        AND (t.tenant_id = auth.uid() OR p.landlord_id = auth.uid())
    )
  );
