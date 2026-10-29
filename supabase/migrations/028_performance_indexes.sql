-- Performance indexes for common query patterns

-- maintenance_requests: tenant realtime filter + landlord list
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_tenancy_id
  ON maintenance_requests (tenancy_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status
  ON maintenance_requests (status);

CREATE INDEX IF NOT EXISTS idx_maintenance_requests_created_at
  ON maintenance_requests (created_at DESC);

-- rent_payments: tenant and landlord queries
CREATE INDEX IF NOT EXISTS idx_rent_payments_tenancy_id
  ON rent_payments (tenancy_id);

CREATE INDEX IF NOT EXISTS idx_rent_payments_due_date
  ON rent_payments (due_date);

CREATE INDEX IF NOT EXISTS idx_rent_payments_status
  ON rent_payments (status);

-- tenancies: landlord lookup by property, tenant lookup by user
CREATE INDEX IF NOT EXISTS idx_tenancies_property_id
  ON tenancies (property_id);

CREATE INDEX IF NOT EXISTS idx_tenancies_tenant_id
  ON tenancies (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenancies_status
  ON tenancies (status);

-- inspections: landlord list by tenancy
CREATE INDEX IF NOT EXISTS idx_inspections_tenancy_id
  ON inspections (tenancy_id);

-- inspection_photos: lookup by inspection
CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection_id
  ON inspection_photos (inspection_id);

-- expenses: landlord list by property and date
CREATE INDEX IF NOT EXISTS idx_expenses_property_id
  ON expenses (property_id);

CREATE INDEX IF NOT EXISTS idx_expenses_expense_date
  ON expenses (expense_date DESC);

-- documents: landlord list by property
CREATE INDEX IF NOT EXISTS idx_documents_property_id
  ON documents (property_id);

-- messages: tenant/landlord inbox
CREATE INDEX IF NOT EXISTS idx_messages_tenancy_id
  ON messages (tenancy_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON messages (sender_id);

-- role_assignments: user role lookup
CREATE INDEX IF NOT EXISTS idx_role_assignments_user_id
  ON role_assignments (user_id);

-- properties: landlord lookup
CREATE INDEX IF NOT EXISTS idx_properties_landlord_id
  ON properties (landlord_id);
