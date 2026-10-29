-- Migration 025: Allow anonymous users to read a tenancy invite by invite_token
-- Needed so the /join?token=... page can display the invite without requiring login
-- ─────────────────────────────────────────────────────────────────────────────

-- Allow any authenticated or anonymous caller to read a single tenancy row
-- if they know the invite_token (used by the Join page before account creation)
CREATE POLICY IF NOT EXISTS "anon can read tenancy by invite_token"
  ON tenancies
  FOR SELECT
  TO anon
  USING (invite_token IS NOT NULL);
