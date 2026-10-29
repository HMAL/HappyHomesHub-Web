-- ── Handyman: read tenancies for jobs assigned to them ───────────────────────
-- Without this, the nested join maintenance_requests→tenancies returns null.
CREATE POLICY "handyman can view assigned tenancy"
  ON public.tenancies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
      WHERE mr.tenancy_id = tenancies.id
        AND mr.handyman_id = auth.uid()
    )
  );

-- ── Handyman: read properties for jobs assigned to them ───────────────────────
-- Without this, the nested join tenancies→properties returns null, causing
-- landlord_id to be unavailable when the handyman submits an invoice.
CREATE POLICY "handyman can view assigned property"
  ON public.properties
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
      JOIN public.tenancies t ON t.id = mr.tenancy_id
      WHERE t.property_id = properties.id
        AND mr.handyman_id = auth.uid()
    )
  );

-- ── Handyman: insert invoice expenses on their assigned jobs ──────────────────
-- The existing "expenses_landlord" FOR ALL policy uses USING (landlord_id = auth.uid()),
-- which blocks handyman inserts. Postgres OR's permissive policies, so this
-- separate INSERT-only policy allows the operation when conditions are met.
CREATE POLICY "handyman can submit invoice expense"
  ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    maintenance_request_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
      WHERE mr.id = maintenance_request_id
        AND mr.handyman_id = auth.uid()
    )
  );

-- ── Handyman: read their own submitted invoices (for revenue dashboard) ───────
CREATE POLICY "handyman can view own invoices"
  ON public.expenses
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    AND maintenance_request_id IS NOT NULL
  );
