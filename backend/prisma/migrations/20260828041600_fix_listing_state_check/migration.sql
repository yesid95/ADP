ALTER TABLE harvest_listings
  DROP CHECK harvest_listings_publish_state_ck,
  ADD CONSTRAINT harvest_listings_publish_state_ck
    CHECK (
      (status = 'DRAFT' AND published_at IS NULL AND closed_at IS NULL)
      OR (status = 'OPEN' AND published_at IS NOT NULL AND closed_at IS NULL)
      OR (status IN ('CLOSED', 'AWARDED') AND published_at IS NOT NULL AND closed_at IS NOT NULL)
      OR (status = 'CANCELLED' AND closed_at IS NOT NULL)
    );
