-- "Free for N months" promo. discount_type='free_months' with discount_value =
-- the number of months. The checkout function applies a $10/mo (one property)
-- Stripe coupon repeating for N months: a single-property landlord pays $0, any
-- extra properties bill normally, then full $10/property billing resumes.

-- Launch FREE code: one property free for 3 months, expires 2026-06-21, capped at
-- 100 redemptions (one per landlord — so 100 landlords, each one free property).
insert into public.promo_codes (code, description, discount_type, discount_value, max_uses, expires_at)
values (
  'FREE',
  'One property free for 3 months — limited launch offer.',
  'free_months',
  3,
  100,
  '2026-06-21T23:59:59Z'
)
on conflict (code) do nothing;
