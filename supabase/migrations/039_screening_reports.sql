-- Applicant screening reports: paid TransUnion SmartMove Premium package
-- $70 charge covers report ($48) + eSignature consent + Stripe fees + HHH margin
-- Report is valid for 90 days and reusable across any property on the platform

CREATE TABLE IF NOT EXISTS screening_reports (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id              uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_session_id         text,
  stripe_payment_intent_id  text,
  amount_paid               integer     NOT NULL DEFAULT 7000,  -- cents
  report_status             text        NOT NULL DEFAULT 'pending'
                              CHECK (report_status IN ('pending', 'processing', 'completed', 'failed')),
  smartmove_order_id        text,
  report_url                text,
  score                     integer,
  recommendation            text        CHECK (recommendation IN ('approved', 'consider', 'declined')),
  expires_at                timestamptz NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE screening_reports ENABLE ROW LEVEL SECURITY;

-- Applicant sees their own reports
CREATE POLICY "screening_applicant_read_own" ON screening_reports
  FOR SELECT USING (applicant_id = auth.uid());

-- Applicant can insert their own record (checkout success redirects with user context)
CREATE POLICY "screening_applicant_insert_own" ON screening_reports
  FOR INSERT WITH CHECK (applicant_id = auth.uid());

-- Landlords can read screening reports for tenants who have applied to their properties
CREATE POLICY "screening_landlord_read" ON screening_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM applications a
      JOIN tenancies t   ON t.id = a.tenancy_id
      JOIN properties p  ON p.id = t.property_id
      WHERE a.applicant_id = screening_reports.applicant_id
        AND p.landlord_id  = auth.uid()
    )
  );

-- Index for fast applicant lookups (validity check on every application save)
CREATE INDEX IF NOT EXISTS idx_screening_reports_applicant_expires
  ON screening_reports (applicant_id, expires_at DESC);
