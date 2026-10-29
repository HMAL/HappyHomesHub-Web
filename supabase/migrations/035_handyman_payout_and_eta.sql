-- Migration 035: Handyman ETA + in-app payout
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds two consumer-facing capabilities to maintenance_requests:
--   1. scheduled_for — when the pro is coming (feeds the tenant repair timeline)
--   2. payout fields — landlord pays the assigned handyman in-app via Stripe
--      Connect (reuses the rails from migration 034). Platform takes $0.
--
-- The payout_* / *_paid_at columns are written only by edge functions (service
-- role); scheduled_for is set by the assigned handyman (existing update policy
-- "handyman_id = auth.uid()" already permits this).

alter table public.maintenance_requests
  add column if not exists scheduled_for           timestamptz,
  add column if not exists payout_status           text not null default 'none'
        check (payout_status in ('none', 'pending', 'paid')),
  add column if not exists payout_amount           numeric(10,2),
  add column if not exists payout_session_id        text,
  add column if not exists handyman_paid_at         timestamptz;

-- Guard the payout columns against client tampering (clients may still set
-- scheduled_for and status). Service-role writes have auth.uid() = null and pass
-- through untouched.
create or replace function public.guard_payout_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.payout_status     := old.payout_status;
    new.payout_amount     := old.payout_amount;
    new.payout_session_id := old.payout_session_id;
    new.handyman_paid_at  := old.handyman_paid_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_payout_columns on public.maintenance_requests;
create trigger trg_guard_payout_columns
  before update on public.maintenance_requests
  for each row execute function public.guard_payout_columns();
