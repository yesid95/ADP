#!/bin/sh
set -eu

for variable in \
  MYSQL_ROOT_PASSWORD \
  MYSQL_AUTH_PASSWORD \
  MYSQL_MARKET_PASSWORD \
  MYSQL_AUDIT_PASSWORD \
  MYSQL_AUDITOR_PASSWORD \
  MYSQL_MIGRATOR_PASSWORD \
  MYSQL_BACKUP_PASSWORD
do
  eval "value=\${$variable:-}"
  if [ -z "$value" ]; then
    echo "$variable is required" >&2
    exit 1
  fi
  case "$value" in
    *[!A-Za-z0-9_@%+=:,.-]*)
      echo "$variable contains unsupported characters" >&2
      exit 1
      ;;
  esac
done

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
DROP TRIGGER IF EXISTS adp.audit_events_chain_before_insert;
DROP TRIGGER IF EXISTS adp.audit_events_chain_after_insert;
DROP PROCEDURE IF EXISTS adp.lock_audit_chain_head;

DELIMITER \$\$
CREATE PROCEDURE adp.lock_audit_chain_head(OUT locked_hash BINARY(32))
SQL SECURITY DEFINER
BEGIN
  SELECT current_hash
    INTO locked_hash
    FROM adp.audit_chain_heads
    WHERE id = 1
    FOR UPDATE;
END\$\$

CREATE TRIGGER adp.audit_events_chain_before_insert
BEFORE INSERT ON adp.audit_events
FOR EACH ROW
SET NEW.event_hash = IF(
  NEW.previous_hash <=> (
    SELECT current_hash FROM adp.audit_chain_heads WHERE id = 1
  ),
  NEW.event_hash,
  NULL
)\$\$

CREATE TRIGGER adp.audit_events_chain_after_insert
AFTER INSERT ON adp.audit_events
FOR EACH ROW
UPDATE adp.audit_chain_heads
  SET current_hash = NEW.event_hash,
      last_event_id = NEW.id
  WHERE id = 1\$\$
DELIMITER ;

CREATE USER IF NOT EXISTS 'adp_auth'@'%' IDENTIFIED BY '${MYSQL_AUTH_PASSWORD}';
CREATE USER IF NOT EXISTS 'adp_market'@'%' IDENTIFIED BY '${MYSQL_MARKET_PASSWORD}';
CREATE USER IF NOT EXISTS 'adp_audit_writer'@'%' IDENTIFIED BY '${MYSQL_AUDIT_PASSWORD}';
CREATE USER IF NOT EXISTS 'adp_auditor'@'%' IDENTIFIED BY '${MYSQL_AUDITOR_PASSWORD}';
CREATE USER IF NOT EXISTS 'adp_migrator'@'%' IDENTIFIED BY '${MYSQL_MIGRATOR_PASSWORD}';
CREATE USER IF NOT EXISTS 'adp_backup'@'%' IDENTIFIED BY '${MYSQL_BACKUP_PASSWORD}';

ALTER USER 'adp_auth'@'%' IDENTIFIED BY '${MYSQL_AUTH_PASSWORD}';
ALTER USER 'adp_market'@'%' IDENTIFIED BY '${MYSQL_MARKET_PASSWORD}';
ALTER USER 'adp_audit_writer'@'%' IDENTIFIED BY '${MYSQL_AUDIT_PASSWORD}';
ALTER USER 'adp_auditor'@'%' IDENTIFIED BY '${MYSQL_AUDITOR_PASSWORD}';
ALTER USER 'adp_migrator'@'%' IDENTIFIED BY '${MYSQL_MIGRATOR_PASSWORD}';
ALTER USER 'adp_backup'@'%' IDENTIFIED BY '${MYSQL_BACKUP_PASSWORD}';

REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'adp_auth'@'%';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'adp_market'@'%';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'adp_audit_writer'@'%';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'adp_auditor'@'%';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'adp_migrator'@'%';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'adp_backup'@'%';

GRANT SELECT, INSERT, UPDATE ON adp.users TO 'adp_auth'@'%';
GRANT SELECT, INSERT, UPDATE ON adp.user_private_contacts TO 'adp_auth'@'%';
GRANT SELECT, INSERT, UPDATE ON adp.password_credentials TO 'adp_auth'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON adp.user_roles TO 'adp_auth'@'%';
GRANT SELECT, INSERT, UPDATE ON adp.auth_sessions TO 'adp_auth'@'%';
GRANT SELECT, INSERT, UPDATE ON adp.auth_tokens TO 'adp_auth'@'%';
GRANT SELECT, INSERT, UPDATE ON adp.mfa_factors TO 'adp_auth'@'%';
GRANT SELECT, INSERT, UPDATE ON adp.mfa_recovery_codes TO 'adp_auth'@'%';
GRANT SELECT, INSERT, UPDATE ON adp.farmer_profiles TO 'adp_auth'@'%';
GRANT SELECT, INSERT, UPDATE ON adp.buyer_profiles TO 'adp_auth'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON adp.buyer_crop_interests TO 'adp_auth'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON adp.buyer_municipality_interests TO 'adp_auth'@'%';
GRANT SELECT ON adp.departments TO 'adp_auth'@'%';
GRANT SELECT ON adp.municipalities TO 'adp_auth'@'%';
GRANT SELECT ON adp.crop_varieties TO 'adp_auth'@'%';
GRANT INSERT ON adp.audit_events TO 'adp_auth'@'%';
GRANT EXECUTE ON PROCEDURE adp.lock_audit_chain_head TO 'adp_auth'@'%';

GRANT SELECT ON adp.users TO 'adp_market'@'%';
GRANT SELECT ON adp.user_roles TO 'adp_market'@'%';
GRANT SELECT ON adp.farmer_profiles TO 'adp_market'@'%';
GRANT SELECT ON adp.buyer_profiles TO 'adp_market'@'%';
GRANT SELECT ON adp.buyer_crop_interests TO 'adp_market'@'%';
GRANT SELECT ON adp.buyer_municipality_interests TO 'adp_market'@'%';
GRANT SELECT ON adp.departments TO 'adp_market'@'%';
GRANT SELECT ON adp.municipalities TO 'adp_market'@'%';
GRANT SELECT ON adp.crop_varieties TO 'adp_market'@'%';
GRANT SELECT, INSERT, UPDATE ON adp.farms TO 'adp_market'@'%';
GRANT SELECT, INSERT, UPDATE ON adp.harvest_listings TO 'adp_market'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON adp.harvest_photos TO 'adp_market'@'%';
GRANT SELECT, INSERT, UPDATE ON adp.bids TO 'adp_market'@'%';
GRANT SELECT, INSERT ON adp.bid_versions TO 'adp_market'@'%';
GRANT SELECT ON adp.v_anonymous_bid_latest TO 'adp_market'@'%';
GRANT SELECT, INSERT, UPDATE ON adp.listing_awards TO 'adp_market'@'%';
GRANT SELECT, INSERT ON adp.listing_status_events TO 'adp_market'@'%';
GRANT SELECT, INSERT ON adp.bid_status_events TO 'adp_market'@'%';
GRANT SELECT, INSERT ON adp.idempotency_records TO 'adp_market'@'%';
GRANT INSERT ON adp.audit_events TO 'adp_market'@'%';
GRANT EXECUTE ON PROCEDURE adp.lock_audit_chain_head TO 'adp_market'@'%';

GRANT INSERT ON adp.audit_events TO 'adp_audit_writer'@'%';
GRANT EXECUTE ON PROCEDURE adp.lock_audit_chain_head TO 'adp_audit_writer'@'%';
GRANT SELECT ON adp.audit_events TO 'adp_auditor'@'%';
GRANT SELECT ON adp.audit_chain_heads TO 'adp_auditor'@'%';
GRANT ALL PRIVILEGES ON adp.* TO 'adp_migrator'@'%';
GRANT SELECT, SHOW VIEW, TRIGGER, EVENT, LOCK TABLES ON adp.* TO 'adp_backup'@'%';
GRANT RELOAD, REPLICATION CLIENT, SHOW_ROUTINE ON *.* TO 'adp_backup'@'%';

FLUSH PRIVILEGES;
SQL
