-- Migration 038: Store contact-form submissions (optional persistence).
-- The contact edge function emails support via Resend and best-effort inserts here.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  message    text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;
-- No client policies: only the service role (the contact function) can write/read.
