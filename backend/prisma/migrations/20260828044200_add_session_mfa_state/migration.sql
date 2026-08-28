ALTER TABLE `auth_sessions`
  ADD COLUMN `mfa_verified_at` DATETIME(3) NULL AFTER `user_agent_hash`;

ALTER TABLE `mfa_factors`
  MODIFY COLUMN `enabled_at` DATETIME(3) NULL;

CREATE INDEX `auth_sessions_mfa_verified_idx`
  ON `auth_sessions` (`user_id`, `mfa_verified_at`);
