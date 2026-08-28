-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `display_name` VARCHAR(120) NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `version` INTEGER UNSIGNED NOT NULL DEFAULT 1,

    INDEX `users_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_private_contacts` (
    `user_id` CHAR(36) NOT NULL,
    `email_ciphertext` VARBINARY(512) NOT NULL,
    `email_lookup_hash` BINARY(32) NOT NULL,
    `phone_ciphertext` VARBINARY(512) NULL,
    `phone_lookup_hash` BINARY(32) NULL,
    `key_version` SMALLINT UNSIGNED NOT NULL,
    `email_verified_at` DATETIME(3) NULL,
    `phone_verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_contacts_email_lookup_uq`(`email_lookup_hash`),
    UNIQUE INDEX `user_contacts_phone_lookup_uq`(`phone_lookup_hash`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_credentials` (
    `user_id` CHAR(36) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `password_changed_at` DATETIME(3) NOT NULL,
    `failed_login_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `user_id` CHAR(36) NOT NULL,
    `role_code` ENUM('FARMER', 'BUYER', 'ADMIN') NOT NULL,
    `assigned_by_user_id` CHAR(36) NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_roles_role_idx`(`role_code`, `user_id`),
    PRIMARY KEY (`user_id`, `role_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_sessions` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `refresh_token_hash` BINARY(32) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `last_used_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `rotated_from_session_id` CHAR(36) NULL,
    `ip_prefix_hash` BINARY(32) NULL,
    `user_agent_hash` BINARY(32) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `auth_sessions_refresh_hash_uq`(`refresh_token_hash`),
    UNIQUE INDEX `auth_sessions_rotated_from_uq`(`rotated_from_session_id`),
    INDEX `auth_sessions_user_active_idx`(`user_id`, `revoked_at`, `expires_at`),
    INDEX `auth_sessions_expiry_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auth_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `purpose` ENUM('VERIFY_EMAIL', 'VERIFY_PHONE', 'RESET_PASSWORD') NOT NULL,
    `token_hash` BINARY(32) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `auth_tokens_hash_uq`(`token_hash`),
    INDEX `auth_tokens_user_purpose_idx`(`user_id`, `purpose`, `used_at`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mfa_factors` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `factor_type` ENUM('TOTP') NOT NULL,
    `secret_ciphertext` VARBINARY(512) NOT NULL,
    `key_version` SMALLINT UNSIGNED NOT NULL,
    `enabled_at` DATETIME(3) NOT NULL,
    `last_used_step` BIGINT UNSIGNED NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mfa_factors_user_active_idx`(`user_id`, `revoked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mfa_recovery_codes` (
    `id` CHAR(36) NOT NULL,
    `factor_id` CHAR(36) NOT NULL,
    `code_hash` BINARY(32) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `mfa_recovery_codes_hash_uq`(`code_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` SMALLINT UNSIGNED NOT NULL,
    `dane_code` CHAR(2) NOT NULL,
    `name` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `departments_dane_code_uq`(`dane_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `municipalities` (
    `id` SMALLINT UNSIGNED NOT NULL,
    `department_id` SMALLINT UNSIGNED NOT NULL,
    `dane_code` CHAR(5) NOT NULL,
    `name` VARCHAR(120) NOT NULL,

    UNIQUE INDEX `municipalities_dane_code_uq`(`dane_code`),
    INDEX `municipalities_department_name_idx`(`department_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `farmer_profiles` (
    `user_id` CHAR(36) NOT NULL,
    `public_bio` TEXT NULL,
    `verification_status` ENUM('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'UNVERIFIED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `buyer_profiles` (
    `user_id` CHAR(36) NOT NULL,
    `business_name` VARCHAR(160) NULL,
    `buyer_type` ENUM('WHOLESALER', 'DISTRIBUTOR', 'STORE', 'RESTAURANT', 'TRANSPORTER') NOT NULL,
    `description` TEXT NULL,
    `verification_status` ENUM('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'UNVERIFIED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `buyer_profiles_type_status_idx`(`buyer_type`, `verification_status`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `farms` (
    `id` CHAR(36) NOT NULL,
    `owner_user_id` CHAR(36) NOT NULL,
    `municipality_id` SMALLINT UNSIGNED NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `vereda` VARCHAR(120) NOT NULL,
    `public_location_text` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `road_access_notes` VARCHAR(500) NULL,
    `productive_hectares` DECIMAL(10, 2) NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `version` INTEGER UNSIGNED NOT NULL DEFAULT 1,

    INDEX `farms_owner_status_idx`(`owner_user_id`, `status`),
    INDEX `farms_municipality_status_idx`(`municipality_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crop_varieties` (
    `id` SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `crop_varieties_code_uq`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `buyer_crop_interests` (
    `buyer_user_id` CHAR(36) NOT NULL,
    `crop_variety_id` SMALLINT UNSIGNED NOT NULL,
    `minimum_quantity_kg` DECIMAL(12, 3) NULL,
    `maximum_quantity_kg` DECIMAL(12, 3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`buyer_user_id`, `crop_variety_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `buyer_municipality_interests` (
    `buyer_user_id` CHAR(36) NOT NULL,
    `municipality_id` SMALLINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`buyer_user_id`, `municipality_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `harvest_listings` (
    `id` CHAR(36) NOT NULL,
    `farm_id` CHAR(36) NOT NULL,
    `crop_variety_id` SMALLINT UNSIGNED NOT NULL,
    `estimated_quantity_kg` DECIMAL(12, 3) NOT NULL,
    `available_from_date` DATE NOT NULL,
    `crop_condition_notes` VARCHAR(500) NULL,
    `road_access_snapshot` VARCHAR(500) NULL,
    `expected_price_cop_per_kg` DECIMAL(18, 2) NULL,
    `allows_partial_purchase` BOOLEAN NOT NULL DEFAULT false,
    `bid_deadline_at` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'CLOSED', 'AWARDED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `published_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `version` INTEGER UNSIGNED NOT NULL DEFAULT 1,

    INDEX `harvest_listings_status_deadline_idx`(`status`, `bid_deadline_at`),
    INDEX `harvest_listings_farm_created_idx`(`farm_id`, `created_at`),
    INDEX `harvest_listings_search_idx`(`crop_variety_id`, `status`, `available_from_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `harvest_photos` (
    `id` CHAR(36) NOT NULL,
    `listing_id` CHAR(36) NOT NULL,
    `storage_key` VARCHAR(512) NOT NULL,
    `mime_type` VARCHAR(50) NOT NULL,
    `size_bytes` INTEGER UNSIGNED NOT NULL,
    `sha256` BINARY(32) NOT NULL,
    `sort_order` SMALLINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `harvest_photos_order_uq`(`listing_id`, `sort_order`),
    UNIQUE INDEX `harvest_photos_content_uq`(`listing_id`, `sha256`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bids` (
    `id` CHAR(36) NOT NULL,
    `listing_id` CHAR(36) NOT NULL,
    `buyer_user_id` CHAR(36) NOT NULL,
    `anonymous_label` VARCHAR(16) NOT NULL,
    `status` ENUM('SUBMITTED', 'WITHDRAWN', 'ACCEPTED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'SUBMITTED',
    `current_version_no` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `withdrawn_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `version` INTEGER UNSIGNED NOT NULL DEFAULT 1,

    INDEX `bids_listing_status_idx`(`listing_id`, `status`, `submitted_at`),
    INDEX `bids_buyer_status_idx`(`buyer_user_id`, `status`, `submitted_at`),
    UNIQUE INDEX `bids_listing_buyer_uq`(`listing_id`, `buyer_user_id`),
    UNIQUE INDEX `bids_listing_label_uq`(`listing_id`, `anonymous_label`),
    UNIQUE INDEX `bids_listing_id_uq`(`listing_id`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bid_versions` (
    `bid_id` CHAR(36) NOT NULL,
    `version_no` SMALLINT UNSIGNED NOT NULL,
    `unit_price_cop_per_kg` DECIMAL(18, 2) NOT NULL,
    `offered_quantity_kg` DECIMAL(12, 3) NOT NULL,
    `transport_included` BOOLEAN NOT NULL DEFAULT false,
    `pickup_at_farm` BOOLEAN NOT NULL DEFAULT false,
    `seller_logistics_cost_cop` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `advance_amount_cop` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `payment_term_days` SMALLINT UNSIGNED NOT NULL,
    `continuity_months` SMALLINT UNSIGNED NULL,
    `continuity_notes` VARCHAR(500) NULL,
    `observations` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`bid_id`, `version_no`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `listing_awards` (
    `listing_id` CHAR(36) NOT NULL,
    `bid_id` CHAR(36) NOT NULL,
    `bid_version_no` SMALLINT UNSIGNED NOT NULL,
    `accepted_by_user_id` CHAR(36) NOT NULL,
    `accepted_at` DATETIME(3) NOT NULL,
    `buyer_identity_revealed_at` DATETIME(3) NULL,
    `whatsapp_opened_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `listing_awards_bid_uq`(`bid_id`),
    UNIQUE INDEX `listing_awards_listing_bid_uq`(`listing_id`, `bid_id`),
    UNIQUE INDEX `listing_awards_bid_version_uq`(`bid_id`, `bid_version_no`),
    PRIMARY KEY (`listing_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `listing_status_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `listing_id` CHAR(36) NOT NULL,
    `from_status` ENUM('DRAFT', 'OPEN', 'CLOSED', 'AWARDED', 'CANCELLED') NULL,
    `to_status` ENUM('DRAFT', 'OPEN', 'CLOSED', 'AWARDED', 'CANCELLED') NOT NULL,
    `changed_by_user_id` CHAR(36) NULL,
    `reason_code` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `listing_status_events_timeline_idx`(`listing_id`, `created_at`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bid_status_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `bid_id` CHAR(36) NOT NULL,
    `from_status` ENUM('SUBMITTED', 'WITHDRAWN', 'ACCEPTED', 'REJECTED', 'EXPIRED') NULL,
    `to_status` ENUM('SUBMITTED', 'WITHDRAWN', 'ACCEPTED', 'REJECTED', 'EXPIRED') NOT NULL,
    `changed_by_user_id` CHAR(36) NULL,
    `reason_code` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bid_status_events_timeline_idx`(`bid_id`, `created_at`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idempotency_records` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `operation_code` VARCHAR(50) NOT NULL,
    `idempotency_key_hash` BINARY(32) NOT NULL,
    `request_hash` BINARY(32) NOT NULL,
    `resource_type` VARCHAR(40) NULL,
    `resource_id` CHAR(36) NULL,
    `response_code` SMALLINT UNSIGNED NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idempotency_expiry_idx`(`expires_at`),
    UNIQUE INDEX `idempotency_operation_key_uq`(`user_id`, `operation_code`, `idempotency_key_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actor_user_id` CHAR(36) NULL,
    `action_code` VARCHAR(80) NOT NULL,
    `entity_type` VARCHAR(40) NOT NULL,
    `entity_id` CHAR(36) NULL,
    `outcome` ENUM('SUCCESS', 'DENIED', 'FAILED') NOT NULL,
    `request_id` CHAR(36) NOT NULL,
    `ip_hash` BINARY(32) NULL,
    `metadata` JSON NULL,
    `previous_hash` BINARY(32) NULL,
    `event_hash` BINARY(32) NOT NULL,

    INDEX `audit_events_time_idx`(`occurred_at`, `id`),
    INDEX `audit_events_actor_idx`(`actor_user_id`, `occurred_at`),
    INDEX `audit_events_action_idx`(`action_code`, `occurred_at`),
    INDEX `audit_events_entity_idx`(`entity_type`, `entity_id`, `occurred_at`),
    INDEX `audit_events_request_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_private_contacts` ADD CONSTRAINT `user_private_contacts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_credentials` ADD CONSTRAINT `password_credentials_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_assigned_by_user_id_fkey` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_rotated_from_session_id_fkey` FOREIGN KEY (`rotated_from_session_id`) REFERENCES `auth_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auth_tokens` ADD CONSTRAINT `auth_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mfa_factors` ADD CONSTRAINT `mfa_factors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mfa_recovery_codes` ADD CONSTRAINT `mfa_recovery_codes_factor_id_fkey` FOREIGN KEY (`factor_id`) REFERENCES `mfa_factors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `municipalities` ADD CONSTRAINT `municipalities_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `farmer_profiles` ADD CONSTRAINT `farmer_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `buyer_profiles` ADD CONSTRAINT `buyer_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `farms` ADD CONSTRAINT `farms_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `farms` ADD CONSTRAINT `farms_municipality_id_fkey` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `buyer_crop_interests` ADD CONSTRAINT `buyer_crop_interests_buyer_user_id_fkey` FOREIGN KEY (`buyer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `buyer_crop_interests` ADD CONSTRAINT `buyer_crop_interests_crop_variety_id_fkey` FOREIGN KEY (`crop_variety_id`) REFERENCES `crop_varieties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `buyer_municipality_interests` ADD CONSTRAINT `buyer_municipality_interests_buyer_user_id_fkey` FOREIGN KEY (`buyer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `buyer_municipality_interests` ADD CONSTRAINT `buyer_municipality_interests_municipality_id_fkey` FOREIGN KEY (`municipality_id`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `harvest_listings` ADD CONSTRAINT `harvest_listings_farm_id_fkey` FOREIGN KEY (`farm_id`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `harvest_listings` ADD CONSTRAINT `harvest_listings_crop_variety_id_fkey` FOREIGN KEY (`crop_variety_id`) REFERENCES `crop_varieties`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `harvest_photos` ADD CONSTRAINT `harvest_photos_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `harvest_listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bids` ADD CONSTRAINT `bids_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `harvest_listings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bids` ADD CONSTRAINT `bids_buyer_user_id_fkey` FOREIGN KEY (`buyer_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bid_versions` ADD CONSTRAINT `bid_versions_bid_id_fkey` FOREIGN KEY (`bid_id`) REFERENCES `bids`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listing_awards` ADD CONSTRAINT `listing_awards_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `harvest_listings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listing_awards` ADD CONSTRAINT `listing_awards_listing_id_bid_id_fkey` FOREIGN KEY (`listing_id`, `bid_id`) REFERENCES `bids`(`listing_id`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listing_awards` ADD CONSTRAINT `listing_awards_bid_id_bid_version_no_fkey` FOREIGN KEY (`bid_id`, `bid_version_no`) REFERENCES `bid_versions`(`bid_id`, `version_no`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listing_awards` ADD CONSTRAINT `listing_awards_accepted_by_user_id_fkey` FOREIGN KEY (`accepted_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listing_status_events` ADD CONSTRAINT `listing_status_events_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `harvest_listings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listing_status_events` ADD CONSTRAINT `listing_status_events_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bid_status_events` ADD CONSTRAINT `bid_status_events_bid_id_fkey` FOREIGN KEY (`bid_id`) REFERENCES `bids`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bid_status_events` ADD CONSTRAINT `bid_status_events_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `idempotency_records` ADD CONSTRAINT `idempotency_records_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Harden row-level invariants that Prisma Schema cannot express.
ALTER TABLE users
  ADD CONSTRAINT users_version_positive_ck CHECK (version > 0),
  ADD CONSTRAINT users_deleted_state_ck CHECK (status <> 'DELETED' OR deleted_at IS NOT NULL);

ALTER TABLE user_private_contacts
  ADD CONSTRAINT user_contacts_phone_pair_ck
    CHECK ((phone_ciphertext IS NULL AND phone_lookup_hash IS NULL)
        OR (phone_ciphertext IS NOT NULL AND phone_lookup_hash IS NOT NULL));

ALTER TABLE auth_sessions
  ADD CONSTRAINT auth_sessions_expiry_ck CHECK (expires_at > created_at);

ALTER TABLE auth_tokens
  ADD CONSTRAINT auth_tokens_expiry_ck CHECK (expires_at > created_at);

ALTER TABLE farms
  ADD CONSTRAINT farms_hectares_positive_ck
    CHECK (productive_hectares IS NULL OR productive_hectares > 0),
  ADD CONSTRAINT farms_version_positive_ck CHECK (version > 0);

ALTER TABLE buyer_crop_interests
  ADD CONSTRAINT buyer_crop_interests_min_ck
    CHECK (minimum_quantity_kg IS NULL OR minimum_quantity_kg > 0),
  ADD CONSTRAINT buyer_crop_interests_max_ck
    CHECK (maximum_quantity_kg IS NULL OR maximum_quantity_kg > 0),
  ADD CONSTRAINT buyer_crop_interests_range_ck
    CHECK (minimum_quantity_kg IS NULL OR maximum_quantity_kg IS NULL
        OR maximum_quantity_kg >= minimum_quantity_kg);

ALTER TABLE harvest_listings
  ADD CONSTRAINT harvest_listings_quantity_positive_ck
    CHECK (estimated_quantity_kg > 0),
  ADD CONSTRAINT harvest_listings_price_positive_ck
    CHECK (expected_price_cop_per_kg IS NULL OR expected_price_cop_per_kg > 0),
  ADD CONSTRAINT harvest_listings_publish_state_ck
    CHECK ((status = 'DRAFT' AND published_at IS NULL)
        OR (status <> 'DRAFT' AND published_at IS NOT NULL)),
  ADD CONSTRAINT harvest_listings_deadline_ck
    CHECK (published_at IS NULL OR bid_deadline_at > published_at),
  ADD CONSTRAINT harvest_listings_version_positive_ck CHECK (version > 0);

ALTER TABLE harvest_photos
  ADD CONSTRAINT harvest_photos_size_positive_ck CHECK (size_bytes > 0),
  ADD CONSTRAINT harvest_photos_mime_ck
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp'));

ALTER TABLE bids
  ADD CONSTRAINT bids_current_version_positive_ck CHECK (current_version_no > 0),
  ADD CONSTRAINT bids_withdrawn_state_ck
    CHECK ((status = 'WITHDRAWN' AND withdrawn_at IS NOT NULL)
        OR (status <> 'WITHDRAWN' AND withdrawn_at IS NULL)),
  ADD CONSTRAINT bids_version_positive_ck CHECK (version > 0);

ALTER TABLE bid_versions
  ADD CONSTRAINT bid_versions_number_positive_ck CHECK (version_no > 0),
  ADD CONSTRAINT bid_versions_price_positive_ck CHECK (unit_price_cop_per_kg > 0),
  ADD CONSTRAINT bid_versions_quantity_positive_ck CHECK (offered_quantity_kg > 0),
  ADD CONSTRAINT bid_versions_logistics_nonnegative_ck CHECK (seller_logistics_cost_cop >= 0),
  ADD CONSTRAINT bid_versions_transport_cost_ck
    CHECK (transport_included = FALSE OR seller_logistics_cost_cop = 0),
  ADD CONSTRAINT bid_versions_advance_range_ck
    CHECK (advance_amount_cop >= 0
       AND advance_amount_cop <= unit_price_cop_per_kg * offered_quantity_kg),
  ADD CONSTRAINT bid_versions_payment_term_ck CHECK (payment_term_days <= 365),
  ADD CONSTRAINT bid_versions_continuity_range_ck
    CHECK (continuity_months IS NULL OR continuity_months BETWEEN 1 AND 120),
  ADD CONSTRAINT bid_versions_continuity_notes_ck
    CHECK (continuity_months IS NULL OR continuity_notes IS NOT NULL);

ALTER TABLE idempotency_records
  ADD CONSTRAINT idempotency_records_expiry_ck CHECK (expires_at > created_at);
