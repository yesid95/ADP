#!/bin/sh
set -eu

: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"
: "${MYSQL_OBSERVER_PASSWORD:?MYSQL_OBSERVER_PASSWORD is required}"

case "${MYSQL_OBSERVER_PASSWORD}" in
  *[!A-Za-z0-9_@%+=:,.-]*)
    echo "MYSQL_OBSERVER_PASSWORD contains unsupported characters" >&2
    exit 1
    ;;
esac

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS 'adp_observer'@'%' IDENTIFIED BY '${MYSQL_OBSERVER_PASSWORD}';
ALTER USER 'adp_observer'@'%' IDENTIFIED BY '${MYSQL_OBSERVER_PASSWORD}';
GRANT SELECT, SHOW VIEW ON adp.* TO 'adp_observer'@'%';
FLUSH PRIVILEGES;
SQL
