CREATE TABLE `audit_chain_heads` (
  `id` TINYINT UNSIGNED NOT NULL,
  `current_hash` BINARY(32) NULL,
  `last_event_id` BIGINT UNSIGNED NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT `audit_chain_heads_singleton_ck` CHECK (`id` = 1),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `audit_chain_heads` (`id`, `current_hash`, `last_event_id`)
SELECT
  1,
  (SELECT `event_hash` FROM `audit_events` ORDER BY `id` DESC LIMIT 1),
  (SELECT `id` FROM `audit_events` ORDER BY `id` DESC LIMIT 1);
