CREATE OR REPLACE VIEW `v_anonymous_bid_latest` AS
SELECT
  b.`id` AS `bid_id`,
  b.`listing_id`,
  b.`anonymous_label`,
  b.`status`,
  b.`submitted_at`,
  v.`version_no`,
  v.`unit_price_cop_per_kg`,
  v.`offered_quantity_kg`,
  v.`transport_included`,
  v.`pickup_at_farm`,
  v.`seller_logistics_cost_cop`,
  v.`advance_amount_cop`,
  v.`payment_term_days`,
  v.`continuity_months`,
  v.`continuity_notes`,
  v.`observations`
FROM `bids` b
INNER JOIN `bid_versions` v
  ON v.`bid_id` = b.`id`
 AND v.`version_no` = b.`current_version_no`;
