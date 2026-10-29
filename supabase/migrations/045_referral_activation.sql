-- Landlord referrals qualify on *activation*, not on payment: the referred
-- landlord must actually populate the portal — add a property AND bring a tenant
-- (invite creates a pending tenancy). This rewards real two-sided growth and
-- blocks empty signups from farming credits.

-- Lock down the generic grant helper to the service role only (it trusts its
-- referee argument, so it must never be callable by end users).
revoke execute on function public.qualify_referral(uuid, text, integer) from public;
revoke execute on function public.qualify_referral(uuid, text, integer) from authenticated;
grant  execute on function public.qualify_referral(uuid, text, integer) to service_role;

-- Caller (the referred landlord) self-qualifies once they have at least one
-- property and at least one tenancy on it. Safe to expose to authenticated users:
-- it only ever acts on auth.uid(), and is idempotent (acts on a 'pending' referral
-- once). Grants both parties a $10 property-month credit.
create or replace function public.qualify_landlord_referral()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referrals%rowtype;
  v_has_property boolean;
  v_has_tenant   boolean;
begin
  select * into v_ref from public.referrals
    where referee_id = auth.uid() and status = 'pending'
    limit 1;
  if not found then
    return;  -- no pending referral to qualify
  end if;

  select exists (
    select 1 from public.properties where landlord_id = auth.uid()
  ) into v_has_property;

  select exists (
    select 1 from public.tenancies t
      join public.properties p on p.id = t.property_id
     where p.landlord_id = auth.uid()
  ) into v_has_tenant;

  if not (v_has_property and v_has_tenant) then
    return;  -- not activated yet
  end if;

  update public.referrals set status = 'rewarded', rewarded_at = now() where id = v_ref.id;

  insert into public.referral_rewards (user_id, referral_id, kind, amount_cents) values
    (v_ref.referrer_id, v_ref.id, 'property_month_free', 1000),
    (v_ref.referee_id,  v_ref.id, 'property_month_free', 1000);
end;
$$;
