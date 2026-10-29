-- Frontend error capture. Users rarely report bugs but will complain publicly,
-- so every caught error (React boundary, window.onerror, unhandled rejection) is
-- logged here for the team to triage. PII is scrubbed client-side before insert.

create table if not exists public.error_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users(id) on delete set null,  -- nullable: errors can occur pre-auth
  error_message text not null,
  error_stack   text,
  error_source  text not null default 'manual'
    check (error_source in ('react_boundary', 'window_onerror', 'unhandled_rejection', 'manual')),
  url           text,
  user_agent    text,
  context       jsonb,
  created_at    timestamptz not null default now()
);

alter table public.error_log enable row level security;

-- Insert-only for everyone (errors happen before auth too); no client SELECT.
-- The owner reads via the Supabase dashboard / service role.
drop policy if exists "error_log_insert_any" on public.error_log;
create policy "error_log_insert_any" on public.error_log
  for insert with check (true);

create index if not exists idx_error_log_created on public.error_log (created_at desc);
