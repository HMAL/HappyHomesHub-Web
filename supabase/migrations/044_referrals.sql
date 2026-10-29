-- Referral loop. Every user gets a shareable code; a new user who signs up with
-- it is linked as a referee. When the referee completes their first paid action
-- (landlord: an active property subscription; tenant: a screening purchase), both
-- parties earn a reward: a $10 property-month credit (landlords) or $10 off their
-- next screening (tenants). Rewards live in a ledger and are applied at billing.

create table if not exists public.referral_codes (
  user_id    uuid primary key references public.users(id) on delete cascade,
  code       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  referee_id  uuid not null unique references public.users(id) on delete cascade,  -- one referral per referee
  code        text not null,
  status      text not null default 'pending' check (status in ('pending', 'rewarded')),
  created_at  timestamptz not null default now(),
  rewarded_at timestamptz
);
create index if not exists idx_referrals_referrer on public.referrals (referrer_id);

create table if not exists public.referral_rewards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  referral_id  uuid references public.referrals(id) on delete set null,
  kind         text not null check (kind in ('property_month_free', 'screening_discount')),
  amount_cents integer not null,
  status       text not null default 'available' check (status in ('available', 'redeemed')),
  created_at   timestamptz not null default now(),
  redeemed_at  timestamptz
);
create index if not exists idx_rewards_user_avail on public.referral_rewards (user_id, kind, status);

alter table public.referral_codes   enable row level security;
alter table public.referrals        enable row level security;
alter table public.referral_rewards enable row level security;

-- Owners read their own code / referrals / rewards. All writes go through the
-- SECURITY DEFINER functions below or the service role.
drop policy if exists "referral_codes_owner_read" on public.referral_codes;
create policy "referral_codes_owner_read" on public.referral_codes
  for select using (user_id = auth.uid());

drop policy if exists "referrals_party_read" on public.referrals;
create policy "referrals_party_read" on public.referrals
  for select using (referrer_id = auth.uid() or referee_id = auth.uid());

drop policy if exists "rewards_owner_read" on public.referral_rewards;
create policy "rewards_owner_read" on public.referral_rewards
  for select using (user_id = auth.uid());

-- Returns the caller's referral code, creating one on first call.
create or replace function public.get_or_create_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select code into v_code from public.referral_codes where user_id = auth.uid();
  if v_code is null then
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    insert into public.referral_codes (user_id, code)
      values (auth.uid(), v_code)
      on conflict (user_id) do nothing;
    select code into v_code from public.referral_codes where user_id = auth.uid();
  end if;
  return v_code;
end;
$$;

-- Caller (the new referee) links themselves to whoever owns p_code. No-op if the
-- code is unknown, is the caller's own, or the caller is already referred.
create or replace function public.redeem_referral(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
begin
  select user_id into v_referrer from public.referral_codes where code = upper(p_code);
  if v_referrer is null or v_referrer = auth.uid() then
    return;
  end if;
  insert into public.referrals (referrer_id, referee_id, code, status)
    values (v_referrer, auth.uid(), upper(p_code), 'pending')
    on conflict (referee_id) do nothing;
end;
$$;

-- Marks the referee's pending referral rewarded and grants both parties a reward.
-- Idempotent: only a 'pending' referral is acted on. Returns the referrer's id
-- (so the webhook can apply their credit), or null if there was nothing to reward.
-- Service-role only (called from the Stripe webhook).
create or replace function public.qualify_referral(p_referee uuid, p_kind text, p_amount integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref public.referrals%rowtype;
begin
  select * into v_ref from public.referrals
    where referee_id = p_referee and status = 'pending'
    limit 1;
  if not found then
    return null;
  end if;

  update public.referrals set status = 'rewarded', rewarded_at = now() where id = v_ref.id;

  insert into public.referral_rewards (user_id, referral_id, kind, amount_cents) values
    (v_ref.referrer_id, v_ref.id, p_kind, p_amount),
    (v_ref.referee_id,  v_ref.id, p_kind, p_amount);

  return v_ref.referrer_id;
end;
$$;
