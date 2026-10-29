-- Two landlord tiers: 'landlord' ($7/property/mo) and 'super' ($10/property/mo).
-- Cost-heavy features (SMS, long photo retention, expenses, in-app payouts,
-- analytics) live on 'super'. users.is_premium is repurposed to mean "on the Super
-- tier" so the existing SMS gate (notify-user) becomes Super-only automatically.

alter table public.subscriptions
  add column if not exists tier text not null default 'landlord'
    check (tier in ('landlord', 'super'));

-- Track that a pre-deletion notice was sent for a Super-tier photo, so the daily
-- prune job doesn't re-notify every run.
alter table public.inspection_photos
  add column if not exists deletion_notice_sent boolean not null default false;

-- The launch code becomes "1 year free" instead of "first property free forever":
-- a $7/property credit for 12 months. On Landlord that nets $0; on Super, $3.
update public.promo_codes
   set discount_type  = 'free_months',
       discount_value = 12,
       description    = 'First property free for 1 year — upgrade to Super Landlord for just $3/mo.'
 where code = 'HAPPYHOMEOWNER';
