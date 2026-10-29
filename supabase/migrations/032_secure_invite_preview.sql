-- Migration 032: Secure the invite preview path
-- ─────────────────────────────────────────────────────────────────────────────
-- Problem:
--   * 001_initial.sql  -> policy "invites_by_token" ON invites FOR SELECT USING (true)
--     Anyone with the public anon key could `select *` on invites, reading EVERY
--     invite token + email + tenancy linkage.
--   * 025_anon_invite_read_policy.sql -> "anon can read tenancy by invite_token"
--     ON tenancies USING (invite_token IS NOT NULL)
--     Exposed rent / deposit / lease dates for every tenancy that ever had a token.
--
-- An RLS USING clause cannot read a request argument, so any anon-readable policy
-- on these tables leaks the whole table without the caller proving they hold the
-- token. The fix is to remove the open policies and expose ONLY a token-scoped
-- preview through a SECURITY DEFINER function that requires the token as input and
-- returns just the 10 columns the Join / Signup preview screens need — never an
-- email list, never applicant PII.

-- 1. Remove the over-permissive policies
drop policy if exists "invites_by_token" on public.invites;
drop policy if exists "anon can read tenancy by invite_token" on public.tenancies;

-- 2. Token-scoped preview RPC
create or replace function public.get_invite_preview(p_token text)
returns table (
  status         text,
  email          text,
  monthly_rent   numeric,
  deposit_amount numeric,
  lease_start    date,
  lease_end      date,
  address_line1  text,
  city           text,
  state          text,
  zip            text
)
language sql
security definer
set search_path = public
as $$
  select i.status, i.email,
         t.monthly_rent, t.deposit_amount, t.lease_start, t.lease_end,
         p.address_line1, p.city, p.state, p.zip
  from public.invites i
  join public.tenancies  t on t.id = i.tenancy_id
  join public.properties p on p.id = t.property_id
  where i.token = p_token
  limit 1;
$$;

-- Only the token-bearing caller can reach the preview; no table-wide read.
revoke all on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
