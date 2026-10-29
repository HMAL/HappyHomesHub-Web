-- handyman_profiles was missing the rating column that the
-- sync_handyman_rating trigger (added in 029) tries to update.
ALTER TABLE public.handyman_profiles
  ADD COLUMN IF NOT EXISTS rating numeric(3,1);

-- Back-fill ratings from any existing reviews
UPDATE public.handyman_profiles hp
SET rating = (
  SELECT ROUND(AVG(r.rating)::numeric, 1)
  FROM public.handyman_reviews r
  WHERE r.handyman_user_id = hp.user_id
)
WHERE EXISTS (
  SELECT 1 FROM public.handyman_reviews r WHERE r.handyman_user_id = hp.user_id
);
