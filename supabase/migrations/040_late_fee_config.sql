-- Late fee configuration per tenancy.
-- Landlord sets grace period (days past due), fee type (fixed $ or % of rent),
-- and the fee amount. The platform displays the calculated fee and auto-populates
-- the RecordPayment modal so the landlord doesn't have to calculate it manually.

ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS late_fee_enabled    boolean        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_fee_grace_days integer        NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS late_fee_type       text           NOT NULL DEFAULT 'fixed'
    CHECK (late_fee_type IN ('fixed', 'percent')),
  ADD COLUMN IF NOT EXISTS late_fee_amount     numeric(10,2);
