-- Handyman reviews: landlords can rate handymen after jobs
CREATE TABLE IF NOT EXISTS handyman_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handyman_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (handyman_user_id, reviewer_id)
);

-- Index for fast lookups per handyman
CREATE INDEX IF NOT EXISTS idx_handyman_reviews_handyman_user_id
  ON handyman_reviews (handyman_user_id);

-- RLS
ALTER TABLE handyman_reviews ENABLE ROW LEVEL SECURITY;

-- Landlords can read all reviews
CREATE POLICY "reviews_read" ON handyman_reviews
  FOR SELECT USING (true);

-- Landlords can insert/upsert their own reviews
CREATE POLICY "reviews_insert" ON handyman_reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- Reviewers can update their own review
CREATE POLICY "reviews_update" ON handyman_reviews
  FOR UPDATE USING (auth.uid() = reviewer_id);

-- Function: recalculate and store avg rating on handyman_profiles after review change
CREATE OR REPLACE FUNCTION sync_handyman_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE handyman_profiles
  SET rating = (
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM handyman_reviews
    WHERE handyman_user_id = COALESCE(NEW.handyman_user_id, OLD.handyman_user_id)
  )
  WHERE user_id = COALESCE(NEW.handyman_user_id, OLD.handyman_user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_handyman_rating
AFTER INSERT OR UPDATE OR DELETE ON handyman_reviews
FOR EACH ROW EXECUTE FUNCTION sync_handyman_rating();
