-- Screening pricing tiers.
-- Both tiers run on TransUnion SmartCheck Plus and stay valid 90 days, reusable
-- across all landlords. They differ only by how many applications they cover:
--   $50 tier -> application_limit = 10
--   $70 tier -> application_limit = NULL (unlimited)
-- Usage is derived at read time from the applications table (count of the
-- applicant's non-draft applications created after the report), so there is no
-- counter column to keep in sync.

ALTER TABLE screening_reports
  ADD COLUMN IF NOT EXISTS application_limit integer;
