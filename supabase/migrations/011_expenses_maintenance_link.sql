-- Link expenses to maintenance tickets (optional)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS maintenance_request_id UUID REFERENCES maintenance_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expenses_maintenance_request_id_idx ON expenses(maintenance_request_id);
