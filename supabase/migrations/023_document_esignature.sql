-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 023 — Document e-signature support
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS signature_status        text NOT NULL DEFAULT 'none'
    CHECK (signature_status IN ('none','requested','signed','declined')),
  ADD COLUMN IF NOT EXISTS signature_requested_at  timestamptz,
  ADD COLUMN IF NOT EXISTS signature_requested_by  uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS signed_at               timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by               uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS signature_image_path    text,
  ADD COLUMN IF NOT EXISTS signer_name_confirmed   text;

CREATE INDEX IF NOT EXISTS idx_documents_sig_status
  ON public.documents(signature_status)
  WHERE signature_status <> 'none';
