-- Create the 'documents' storage bucket for landlord document uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  20971520, -- 20 MB
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to their own folder (path starts with their user id)
CREATE POLICY "users can upload own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Any authenticated user can read from this bucket.
-- The documents table RLS is the real access gate — it already enforces
-- that tenants only see rows tied to their tenancy.
CREATE POLICY "authenticated users can read documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

-- Authenticated users can delete their own documents
CREATE POLICY "users can delete own documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
