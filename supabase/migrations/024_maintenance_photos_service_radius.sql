-- Migration 024: maintenance request photo attachments + handyman service radius
-- ─────────────────────────────────────────────────────────────────────────────

-- Photo paths for maintenance requests (stored in storage)
ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS photo_paths TEXT[] DEFAULT '{}';

-- Service radius in miles for handyman profiles
ALTER TABLE handyman_profiles
  ADD COLUMN IF NOT EXISTS service_radius_miles INTEGER DEFAULT NULL;
