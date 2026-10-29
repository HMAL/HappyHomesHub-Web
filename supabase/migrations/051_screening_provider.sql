-- Automated screening provider (TransUnion) support.
--
-- Until now a screening report was ordered by hand: the Stripe webhook emailed an
-- admin who logged into TransUnion SmartMove, invited the applicant, and pasted the
-- result back into Supabase. These columns let the `screening-order` /
-- `screening-callback` edge functions drive that flow automatically once partner
-- API credentials are configured. The whole path is inert (provider = 'manual')
-- until then, so existing reports are unaffected.
--
-- The existing `smartmove_order_id` column doubles as the provider's request/order
-- id (so callbacks can look the report up). We add:
--   provider        - which integration owns the report ('manual' | 'transunion')
--   invite_url      - the applicant's hosted identity-exam / consent link
--   callback_token  - per-report secret the provider echoes back, so an unauthenticated
--                     callback endpoint can authenticate the postback for THIS report

ALTER TABLE screening_reports
  ADD COLUMN IF NOT EXISTS provider       text NOT NULL DEFAULT 'manual'
                             CHECK (provider IN ('manual', 'transunion')),
  ADD COLUMN IF NOT EXISTS invite_url     text,
  ADD COLUMN IF NOT EXISTS callback_token text;

-- Callbacks arrive keyed by the provider order id; index it for fast lookup.
CREATE INDEX IF NOT EXISTS idx_screening_reports_smartmove_order
  ON screening_reports (smartmove_order_id);

-- callback_token must never be exposed to clients. RLS already restricts row access
-- to the owning applicant + relevant landlord, but neither should ever read the
-- token, so it is only written/read by the service-role edge functions. (No column
-- privileges are granted to anon/authenticated here; the table's RLS SELECT policies
-- intentionally do not include it in any client code path.)
