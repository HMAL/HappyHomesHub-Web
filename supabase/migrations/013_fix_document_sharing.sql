-- ── 1. Backfill tenancy_id on existing documents that only have property_id ──
UPDATE public.documents d
SET tenancy_id = (
  SELECT t.id
  FROM public.tenancies t
  WHERE t.property_id = d.property_id
    AND t.status IN ('active', 'pending_invite')
  ORDER BY t.created_at DESC
  LIMIT 1
)
WHERE d.tenancy_id IS NULL
  AND d.property_id IS NOT NULL;

-- ── 2. Widen documents RLS so tenants can see property-level docs too ─────────
DROP POLICY IF EXISTS "documents_access" ON public.documents;
CREATE POLICY "documents_access" ON public.documents
  FOR ALL USING (
    -- uploader always sees their own docs
    uploaded_by = auth.uid()
    -- landlord or tenant via tenancy_id link
    OR EXISTS (
      SELECT 1 FROM public.tenancies t
      JOIN public.properties p ON p.id = t.property_id
      WHERE t.id = tenancy_id
        AND (t.tenant_id = auth.uid() OR p.landlord_id = auth.uid())
    )
    -- landlord via property_id (docs without tenancy_id)
    OR EXISTS (
      SELECT 1 FROM public.properties
      WHERE id = property_id AND landlord_id = auth.uid()
    )
    -- tenant via property_id (catches docs where tenancy_id is still null)
    OR EXISTS (
      SELECT 1 FROM public.tenancies t
      WHERE t.property_id = property_id
        AND t.tenant_id = auth.uid()
        AND t.status IN ('active', 'pending_invite')
    )
  );

-- ── 3. Fix storage read policy so tenants can create signed URLs ──────────────
-- Drop both possible names (old run may have created either)
DROP POLICY IF EXISTS "users can read own documents" ON storage.objects;
DROP POLICY IF EXISTS "authenticated users can read documents" ON storage.objects;

-- Any authenticated user may create signed URLs; table RLS is the access gate
CREATE POLICY "authenticated users can read documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');
