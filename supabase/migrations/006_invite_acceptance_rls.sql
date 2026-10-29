-- ─────────────────────────────────────────────────────────────────────────────
-- HappyHomesHub  |  Migration 006 — Invite Acceptance (SECURITY DEFINER fn)
--
-- Creates a stored procedure that accepts a tenant invite entirely server-side,
-- bypassing RLS.  Called from the client via supabase.rpc('accept_invite', …).
--
-- Also adds two RLS policies so the direct-DB path works as a fallback.
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. SECURITY DEFINER function — primary accept path ────────────────────────
create or replace function public.accept_invite(p_token text, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
begin
  -- Find the pending invite by token
  select id, tenancy_id
  into v_invite
  from public.invites
  where token = p_token and status = 'pending';

  if not found then
    return json_build_object('success', false, 'error', 'Invite not found or already used');
  end if;

  -- Link the tenant to the tenancy
  update public.tenancies
  set
    tenant_id  = p_user_id,
    status     = 'active',
    updated_by = p_user_id,
    updated_at = now()
  where id = v_invite.tenancy_id;

  -- Mark invite as accepted
  update public.invites
  set
    status     = 'accepted',
    updated_by = p_user_id,
    updated_at = now()
  where id = v_invite.id;

  -- Ensure the user has a tenant role_assignment
  insert into public.role_assignments
    (user_id, role, context_id, context_type, created_by, updated_by)
  values
    (p_user_id, 'tenant', p_user_id, 'global', p_user_id, p_user_id)
  on conflict (user_id, role, context_id) do nothing;

  return json_build_object('success', true, 'tenancy_id', v_invite.tenancy_id);
end;
$$;

-- Allow authenticated users to call this function
grant execute on function public.accept_invite(text, uuid) to authenticated;


-- ── 2. RLS fallback policies (used if rpc call is skipped) ───────────────────

-- Let a tenant claim an unclaimed pending_invite tenancy
drop policy if exists "tenancies_accept_invite" on public.tenancies;
create policy "tenancies_accept_invite" on public.tenancies
  for update to authenticated
  using (
    status = 'pending_invite'
    and tenant_id is null
    and exists (
      select 1 from public.invites
      where tenancy_id = tenancies.id and status = 'pending'
    )
  )
  with check (
    tenant_id = auth.uid()
    and status = 'active'
  );

-- Let a tenant mark the invite accepted once they are linked
drop policy if exists "invites_accept" on public.invites;
create policy "invites_accept" on public.invites
  for update to authenticated
  using (
    status = 'pending'
    and exists (
      select 1 from public.tenancies
      where id = invites.tenancy_id and tenant_id = auth.uid()
    )
  )
  with check (status = 'accepted');
