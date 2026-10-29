-- Restrict handyman reviews: a landlord may only rate a handyman
-- if at least one quote from that handyman has been accepted on
-- a maintenance request belonging to this landlord's property.

DROP POLICY IF EXISTS "reviews_insert" ON handyman_reviews;
CREATE POLICY "reviews_insert" ON handyman_reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1
      FROM quotes q
      JOIN maintenance_requests mr ON mr.id = q.request_id
      JOIN tenancies t             ON t.id  = mr.tenancy_id
      JOIN properties p            ON p.id  = t.property_id
      WHERE q.handyman_id = handyman_reviews.handyman_user_id
        AND p.landlord_id = auth.uid()
        AND q.status      = 'accepted'
    )
  );

DROP POLICY IF EXISTS "reviews_update" ON handyman_reviews;
CREATE POLICY "reviews_update" ON handyman_reviews
  FOR UPDATE USING (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1
      FROM quotes q
      JOIN maintenance_requests mr ON mr.id = q.request_id
      JOIN tenancies t             ON t.id  = mr.tenancy_id
      JOIN properties p            ON p.id  = t.property_id
      WHERE q.handyman_id = handyman_reviews.handyman_user_id
        AND p.landlord_id = auth.uid()
        AND q.status      = 'accepted'
    )
  );
