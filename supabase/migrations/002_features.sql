-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 002 — Applications, Rent, Messages, Documents, Expenses
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE throughout.
-- Run AFTER 001_initial.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── TABLES ───────────────────────────────────────────────────────────────────
create table if not exists public.applications (
  id                              uuid primary key default uuid_generate_v4(),
  tenancy_id                      uuid not null references public.tenancies(id) on delete cascade,
  property_id                     uuid not null references public.properties(id) on delete cascade,
  applicant_id                    uuid not null references public.users(id),
  date_of_birth                   date,
  ssn_last_four                   text,
  employer_name                   text,
  employer_phone                  text,
  monthly_income                  numeric(10,2),
  employment_type                 text check (employment_type in ('full_time','part_time','self_employed','unemployed','other')),
  employment_start_date           date,
  current_address                 text,
  current_landlord_name           text,
  current_landlord_phone          text,
  current_monthly_rent            numeric(10,2),
  reason_for_moving               text,
  has_pets                        boolean not null default false,
  pet_description                 text,
  vehicle_count                   integer not null default 0,
  applicant_references            jsonb not null default '[]',
  emergency_contact_name          text,
  emergency_contact_phone         text,
  emergency_contact_relationship  text,
  background_check_consent        boolean not null default false,
  credit_check_consent            boolean not null default false,
  status                          text not null default 'draft'
                                    check (status in ('draft','submitted','under_review','approved','denied')),
  landlord_notes                  text,
  reviewed_by                     uuid references public.users(id),
  reviewed_at                     timestamptz,
  submitted_at                    timestamptz,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  created_by                      uuid not null references public.users(id),
  updated_by                      uuid not null references public.users(id),
  unique (tenancy_id, applicant_id)
);

create table if not exists public.rent_payments (
  id                       uuid primary key default uuid_generate_v4(),
  tenancy_id               uuid not null references public.tenancies(id) on delete cascade,
  amount                   numeric(10,2) not null,
  due_date                 date not null,
  paid_at                  timestamptz,
  payment_method           text check (payment_method in ('stripe','check','cash','bank_transfer','money_order','other')),
  stripe_payment_intent_id text,
  status                   text not null default 'pending'
                             check (status in ('pending','paid','late','waived','partial')),
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  created_by               uuid not null references public.users(id),
  updated_by               uuid not null references public.users(id)
);

create table if not exists public.messages (
  id          uuid primary key default uuid_generate_v4(),
  tenancy_id  uuid not null references public.tenancies(id) on delete cascade,
  sender_id   uuid not null references public.users(id),
  receiver_id uuid references public.users(id),
  body        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.documents (
  id           uuid primary key default uuid_generate_v4(),
  tenancy_id   uuid references public.tenancies(id) on delete cascade,
  property_id  uuid references public.properties(id) on delete cascade,
  uploaded_by  uuid not null references public.users(id),
  type         text not null
                 check (type in ('lease_agreement','inspection_move_in','inspection_move_out','notice','addendum','other')),
  title        text not null,
  storage_path text not null,
  file_size    integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid not null references public.users(id),
  updated_by   uuid not null references public.users(id)
);

create table if not exists public.expenses (
  id           uuid primary key default uuid_generate_v4(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  landlord_id  uuid not null references public.users(id),
  category     text not null
                 check (category in ('maintenance','insurance','taxes','utilities','mortgage','management_fee','landscaping','cleaning','other')),
  description  text not null,
  amount       numeric(10,2) not null,
  expense_date date not null,
  receipt_path text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid not null references public.users(id),
  updated_by   uuid not null references public.users(id)
);

-- ─── TRIGGERS ────────────────────────────────────────────────────────────────
create or replace trigger set_updated_at before update on public.applications
  for each row execute procedure public.set_updated_at();
create or replace trigger set_updated_at before update on public.rent_payments
  for each row execute procedure public.set_updated_at();
create or replace trigger set_updated_at before update on public.documents
  for each row execute procedure public.set_updated_at();
create or replace trigger set_updated_at before update on public.expenses
  for each row execute procedure public.set_updated_at();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
alter table public.applications enable row level security;
alter table public.rent_payments enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "applications_access" on public.applications;
create policy "applications_access" on public.applications
  for all using (
    applicant_id = auth.uid()
    or exists (
      select 1 from public.properties where id = property_id and landlord_id = auth.uid()
    )
  );

drop policy if exists "rent_payments_access" on public.rent_payments;
create policy "rent_payments_access" on public.rent_payments
  for all using (
    exists (
      select 1 from public.tenancies t
      join public.properties p on p.id = t.property_id
      where t.id = tenancy_id
        and (t.tenant_id = auth.uid() or p.landlord_id = auth.uid())
    )
  );

drop policy if exists "messages_access" on public.messages;
create policy "messages_access" on public.messages
  for all using (
    sender_id = auth.uid()
    or receiver_id = auth.uid()
    or exists (
      select 1 from public.tenancies t
      join public.properties p on p.id = t.property_id
      where t.id = tenancy_id
        and (t.tenant_id = auth.uid() or p.landlord_id = auth.uid())
    )
  );

drop policy if exists "documents_access" on public.documents;
create policy "documents_access" on public.documents
  for all using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from public.tenancies t
      join public.properties p on p.id = t.property_id
      where t.id = tenancy_id
        and (t.tenant_id = auth.uid() or p.landlord_id = auth.uid())
    )
    or exists (
      select 1 from public.properties where id = property_id and landlord_id = auth.uid()
    )
  );

drop policy if exists "expenses_landlord" on public.expenses;
create policy "expenses_landlord" on public.expenses
  for all using (landlord_id = auth.uid());

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists idx_applications_tenancy   on public.applications(tenancy_id);
create index if not exists idx_applications_applicant on public.applications(applicant_id);
create index if not exists idx_rent_payments_tenancy  on public.rent_payments(tenancy_id);
create index if not exists idx_rent_payments_due_date on public.rent_payments(due_date);
create index if not exists idx_messages_tenancy       on public.messages(tenancy_id);
create index if not exists idx_messages_created       on public.messages(created_at);
create index if not exists idx_messages_sender        on public.messages(sender_id);
create index if not exists idx_documents_tenancy      on public.documents(tenancy_id);
create index if not exists idx_expenses_property      on public.expenses(property_id);
create index if not exists idx_expenses_date          on public.expenses(expense_date);
