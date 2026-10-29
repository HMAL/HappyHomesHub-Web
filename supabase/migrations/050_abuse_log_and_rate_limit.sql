-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 050 — Abuse logging + a server-side rate-limit primitive
--
-- Adds two service-role-only tables and one atomic rate-limit function used by
-- edge functions (contact, translate-text). Neither table is reachable by anon or
-- authenticated callers — only the service role (which bypasses RLS) can read/write,
-- so clients can never tamper with counters or read abuse records.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Abuse / security-event log ─────────────────────────────────────────────
create table if not exists public.abuse_log (
  id          uuid primary key default gen_random_uuid(),
  event       text not null,                 -- e.g. 'contact_submit', 'rate_limited'
  ip          text,                          -- client IP (from Cloudflare / x-forwarded-for)
  user_id     uuid references public.users(id) on delete set null,
  user_agent  text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_abuse_log_event_created on public.abuse_log(event, created_at desc);
create index if not exists idx_abuse_log_ip_created    on public.abuse_log(ip, created_at desc);

alter table public.abuse_log enable row level security;
-- No policies on purpose: only the service role can touch this table.

-- ── 2. Rate-limit counters (sliding fixed-window) ─────────────────────────────
create table if not exists public.rate_limits (
  key          text primary key,             -- e.g. 'translate:<uuid>' or 'contact:<ip>'
  count        int not null default 0,
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
-- No policies: service role only.

-- ── 3. Atomic check-and-increment ─────────────────────────────────────────────
-- Returns TRUE when the call is within the limit (allowed), FALSE when it should
-- be rejected. Resets the window when it has elapsed. Safe under concurrency via
-- the single upsert + row lock on the primary key.
create or replace function public.rate_limit_check(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now   timestamptz := now();
  v_count int;
begin
  insert into public.rate_limits as rl (key, count, window_start)
    values (p_key, 1, v_now)
  on conflict (key) do update
    set count = case
                  when rl.window_start < v_now - make_interval(secs => p_window_seconds) then 1
                  else rl.count + 1
                end,
        window_start = case
                  when rl.window_start < v_now - make_interval(secs => p_window_seconds) then v_now
                  else rl.window_start
                end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Internal mechanism — never callable by anon/authenticated, only the service role.
revoke all on function public.rate_limit_check(text, int, int) from public, anon, authenticated;

-- ── 4. Optional housekeeping helper (call from a daily cron if desired) ────────
create or replace function public.prune_rate_and_abuse(p_abuse_days int default 90)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
  delete from public.abuse_log   where created_at  < now() - make_interval(days => p_abuse_days);
$$;
revoke all on function public.prune_rate_and_abuse(int) from public, anon, authenticated;
