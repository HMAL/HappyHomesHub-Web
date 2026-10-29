-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 001 — Initial Schema  (idempotent)
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE throughout.
-- Run this FIRST on a brand-new Supabase project.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ─── TABLES ───────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  phone       text,
  full_name   text not null,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.role_assignments (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,
  role          text not null check (role in ('landlord', 'tenant', 'handyman')),
  context_id    uuid not null,
  context_type  text not null check (context_type in ('property', 'tenancy', 'global')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid not null references public.users(id),
  updated_by    uuid not null references public.users(id),
  unique (user_id, role, context_id)
);

create table if not exists public.properties (
  id            uuid primary key default uuid_generate_v4(),
  landlord_id   uuid not null references public.users(id) on delete cascade,
  address_line1 text not null,
  address_line2 text,
  city          text not null,
  state         text not null,
  zip           text not null,
  country       text not null default 'US',
  unit_number   text,
  bedrooms      integer,
  bathrooms     numeric(3,1),
  sqft          integer,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid not null references public.users(id),
  updated_by    uuid not null references public.users(id)
);

create table if not exists public.tenancies (
  id                uuid primary key default uuid_generate_v4(),
  property_id       uuid not null references public.properties(id) on delete cascade,
  tenant_id         uuid references public.users(id),
  lease_start       date,
  lease_end         date,
  monthly_rent      numeric(10,2) not null,
  deposit_amount    numeric(10,2) not null default 0,
  deposit_collected boolean not null default false,
  status            text not null default 'pending_invite'
                      check (status in ('pending_invite', 'active', 'ended')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid not null references public.users(id),
  updated_by        uuid not null references public.users(id)
);

create table if not exists public.invites (
  id          uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  tenancy_id  uuid not null references public.tenancies(id) on delete cascade,
  landlord_id uuid not null references public.users(id),
  email       text,
  phone       text,
  token       text not null unique default encode(gen_random_bytes(32), 'hex'),
  status      text not null default 'pending'
                check (status in ('pending', 'accepted', 'expired')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid not null references public.users(id),
  updated_by  uuid not null references public.users(id),
  check (email is not null or phone is not null)
);

create table if not exists public.inspections (
  id               uuid primary key default uuid_generate_v4(),
  tenancy_id       uuid not null references public.tenancies(id) on delete cascade,
  type             text not null check (type in ('move_in', 'move_out', 'routine')),
  conducted_by     uuid not null references public.users(id),
  notes            text,
  tenant_signed_at timestamptz,
  tenant_signed_by uuid references public.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid not null references public.users(id),
  updated_by       uuid not null references public.users(id)
);

create table if not exists public.inspection_photos (
  id            uuid primary key default uuid_generate_v4(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  storage_path  text not null,
  caption       text,
  room_label    text,
  created_at    timestamptz not null default now(),
  created_by    uuid not null references public.users(id)
);

create table if not exists public.maintenance_requests (
  id           uuid primary key default uuid_generate_v4(),
  tenancy_id   uuid not null references public.tenancies(id) on delete cascade,
  submitted_by uuid not null references public.users(id),
  handyman_id  uuid references public.users(id),
  title        text not null,
  description  text not null,
  priority     text not null default 'medium'
                 check (priority in ('low', 'medium', 'high', 'urgent')),
  status       text not null default 'open'
                 check (status in ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid not null references public.users(id),
  updated_by   uuid not null references public.users(id)
);

create table if not exists public.maintenance_updates (
  id            uuid primary key default uuid_generate_v4(),
  request_id    uuid not null references public.maintenance_requests(id) on delete cascade,
  user_id       uuid not null references public.users(id),
  note          text not null,
  status_change text check (status_change in ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
  created_at    timestamptz not null default now()
);

create table if not exists public.maintenance_photos (
  id           uuid primary key default uuid_generate_v4(),
  request_id   uuid not null references public.maintenance_requests(id) on delete cascade,
  storage_path text not null,
  caption      text,
  created_at   timestamptz not null default now(),
  created_by   uuid not null references public.users(id)
);

create table if not exists public.deposits (
  id              uuid primary key default uuid_generate_v4(),
  tenancy_id      uuid not null references public.tenancies(id) on delete cascade,
  total_amount    numeric(10,2) not null,
  collected_at    timestamptz,
  returned_amount numeric(10,2),
  returned_at     timestamptz,
  deductions      jsonb not null default '[]',
  status          text not null default 'held'
                    check (status in ('held', 'partially_returned', 'returned', 'disputed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid not null references public.users(id),
  updated_by      uuid not null references public.users(id)
);

create table if not exists public.subscriptions (
  id                     uuid primary key default uuid_generate_v4(),
  landlord_id            uuid not null unique references public.users(id),
  stripe_customer_id     text,
  stripe_subscription_id text,
  property_count         integer not null default 1,
  amount_per_property    numeric(6,2) not null default 10,
  status                 text not null default 'active'
                           check (status in ('active', 'past_due', 'canceled', 'trialing')),
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.handyman_profiles (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null unique references public.users(id) on delete cascade,
  skills         text[] not null default '{}',
  availability   text[] not null default '{}',
  service_area   text not null,
  service_phone  text,
  hourly_rate    numeric(8,2),
  bio            text,
  is_available   boolean not null default true,
  verified       boolean not null default false,
  completed_jobs integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.audit_log (
  id         uuid primary key default uuid_generate_v4(),
  table_name text not null,
  record_id  uuid not null,
  field_name text not null,
  old_value  text,
  new_value  text,
  changed_by uuid not null references public.users(id),
  changed_at timestamptz not null default now()
);

-- ─── updated_at FUNCTION + TRIGGERS ─────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Use OR REPLACE (requires Postgres 14+; Supabase runs 15+)
create or replace trigger set_updated_at before update on public.users
  for each row execute procedure public.set_updated_at();
create or replace trigger set_updated_at before update on public.role_assignments
  for each row execute procedure public.set_updated_at();
create or replace trigger set_updated_at before update on public.properties
  for each row execute procedure public.set_updated_at();
create or replace trigger set_updated_at before update on public.tenancies
  for each row execute procedure public.set_updated_at();
create or replace trigger set_updated_at before update on public.invites
  for each row execute procedure public.set_updated_at();
create or replace trigger set_updated_at before update on public.inspections
  for each row execute procedure public.set_updated_at();
create or replace trigger set_updated_at before update on public.maintenance_requests
  for each row execute procedure public.set_updated_at();
create or replace trigger set_updated_at before update on public.deposits
  for each row execute procedure public.set_updated_at();
create or replace trigger set_updated_at before update on public.subscriptions
  for each row execute procedure public.set_updated_at();
create or replace trigger set_updated_at before update on public.handyman_profiles
  for each row execute procedure public.set_updated_at();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.role_assignments enable row level security;
alter table public.properties enable row level security;
alter table public.tenancies enable row level security;
alter table public.invites enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.maintenance_updates enable row level security;
alter table public.maintenance_photos enable row level security;
alter table public.deposits enable row level security;
alter table public.subscriptions enable row level security;
alter table public.handyman_profiles enable row level security;
alter table public.audit_log enable row level security;

-- Users
drop policy if exists "users_own" on public.users;
create policy "users_own" on public.users
  for all using (auth.uid() = id);

drop policy if exists "landlord_can_read_tenants" on public.users;
create policy "landlord_can_read_tenants" on public.users
  for select using (
    exists (
      select 1 from public.tenancies t
      join public.properties p on p.id = t.property_id
      where t.tenant_id = users.id and p.landlord_id = auth.uid()
    )
  );

drop policy if exists "anyone_can_read_handymen" on public.users;
create policy "anyone_can_read_handymen" on public.users
  for select using (
    exists (select 1 from public.handyman_profiles where user_id = users.id)
  );

-- Role assignments
drop policy if exists "role_assignments_own" on public.role_assignments;
create policy "role_assignments_own" on public.role_assignments
  for all using (user_id = auth.uid() or created_by = auth.uid());

-- Properties
drop policy if exists "properties_landlord" on public.properties;
create policy "properties_landlord" on public.properties
  for all using (landlord_id = auth.uid());

drop policy if exists "properties_tenant_view" on public.properties;
create policy "properties_tenant_view" on public.properties
  for select using (
    exists (
      select 1 from public.tenancies
      where property_id = properties.id and tenant_id = auth.uid()
    )
  );

-- Tenancies
drop policy if exists "tenancies_landlord" on public.tenancies;
create policy "tenancies_landlord" on public.tenancies
  for all using (
    exists (select 1 from public.properties where id = property_id and landlord_id = auth.uid())
  );

drop policy if exists "tenancies_tenant" on public.tenancies;
create policy "tenancies_tenant" on public.tenancies
  for select using (tenant_id = auth.uid());

-- Invites
drop policy if exists "invites_landlord" on public.invites;
create policy "invites_landlord" on public.invites
  for all using (landlord_id = auth.uid());

drop policy if exists "invites_by_token" on public.invites;
create policy "invites_by_token" on public.invites
  for select using (true);

-- Inspections
drop policy if exists "inspections_access" on public.inspections;
create policy "inspections_access" on public.inspections
  for all using (
    exists (
      select 1 from public.tenancies t
      join public.properties p on p.id = t.property_id
      where t.id = tenancy_id
        and (t.tenant_id = auth.uid() or p.landlord_id = auth.uid())
    )
  );

drop policy if exists "inspection_photos_access" on public.inspection_photos;
create policy "inspection_photos_access" on public.inspection_photos
  for all using (
    exists (
      select 1 from public.inspections i
      join public.tenancies t on t.id = i.tenancy_id
      join public.properties p on p.id = t.property_id
      where i.id = inspection_id
        and (t.tenant_id = auth.uid() or p.landlord_id = auth.uid())
    )
  );

-- Maintenance requests
drop policy if exists "maintenance_landlord_tenant" on public.maintenance_requests;
create policy "maintenance_landlord_tenant" on public.maintenance_requests
  for all using (
    exists (
      select 1 from public.tenancies t
      join public.properties p on p.id = t.property_id
      where t.id = tenancy_id
        and (t.tenant_id = auth.uid() or p.landlord_id = auth.uid())
    )
  );

drop policy if exists "maintenance_handyman_view" on public.maintenance_requests;
create policy "maintenance_handyman_view" on public.maintenance_requests
  for select using (
    status = 'open'
    or handyman_id = auth.uid()
  );

drop policy if exists "maintenance_handyman_accept" on public.maintenance_requests;
create policy "maintenance_handyman_accept" on public.maintenance_requests
  for update using (
    (status = 'open' and handyman_id is null)
    or handyman_id = auth.uid()
  );

-- Maintenance updates
drop policy if exists "maintenance_updates_access" on public.maintenance_updates;
create policy "maintenance_updates_access" on public.maintenance_updates
  for all using (
    exists (
      select 1 from public.maintenance_requests mr
      join public.tenancies t on t.id = mr.tenancy_id
      join public.properties p on p.id = t.property_id
      where mr.id = request_id
        and (t.tenant_id = auth.uid() or p.landlord_id = auth.uid() or mr.handyman_id = auth.uid())
    )
  );

drop policy if exists "maintenance_updates_insert_handyman" on public.maintenance_updates;
create policy "maintenance_updates_insert_handyman" on public.maintenance_updates
  for insert with check (user_id = auth.uid());

-- Maintenance photos
drop policy if exists "maintenance_photos_access" on public.maintenance_photos;
create policy "maintenance_photos_access" on public.maintenance_photos
  for all using (
    exists (
      select 1 from public.maintenance_requests mr
      join public.tenancies t on t.id = mr.tenancy_id
      join public.properties p on p.id = t.property_id
      where mr.id = request_id
        and (t.tenant_id = auth.uid() or p.landlord_id = auth.uid() or mr.handyman_id = auth.uid())
    )
  );

-- Deposits
drop policy if exists "deposits_access" on public.deposits;
create policy "deposits_access" on public.deposits
  for all using (
    exists (
      select 1 from public.tenancies t
      join public.properties p on p.id = t.property_id
      where t.id = tenancy_id
        and (t.tenant_id = auth.uid() or p.landlord_id = auth.uid())
    )
  );

-- Subscriptions
drop policy if exists "subscriptions_own" on public.subscriptions;
create policy "subscriptions_own" on public.subscriptions
  for all using (landlord_id = auth.uid());

-- Handyman profiles
drop policy if exists "handyman_profiles_own" on public.handyman_profiles;
create policy "handyman_profiles_own" on public.handyman_profiles
  for all using (user_id = auth.uid());

drop policy if exists "handyman_profiles_public_read" on public.handyman_profiles;
create policy "handyman_profiles_public_read" on public.handyman_profiles
  for select using (true);

-- Audit log
drop policy if exists "audit_log_own" on public.audit_log;
create policy "audit_log_own" on public.audit_log
  for select using (changed_by = auth.uid());

-- ─── AUTO-CREATE USER PROFILE ON SIGNUP ──────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists idx_role_assignments_user  on public.role_assignments(user_id);
create index if not exists idx_properties_landlord    on public.properties(landlord_id);
create index if not exists idx_tenancies_property     on public.tenancies(property_id);
create index if not exists idx_tenancies_tenant       on public.tenancies(tenant_id);
create index if not exists idx_invites_token          on public.invites(token);
create index if not exists idx_inspections_tenancy    on public.inspections(tenancy_id);
create index if not exists idx_maintenance_tenancy    on public.maintenance_requests(tenancy_id);
create index if not exists idx_maintenance_handyman   on public.maintenance_requests(handyman_id);
create index if not exists idx_maintenance_status     on public.maintenance_requests(status);
create index if not exists idx_handyman_profiles_user on public.handyman_profiles(user_id);
create index if not exists idx_audit_record           on public.audit_log(table_name, record_id);
