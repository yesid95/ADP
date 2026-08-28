-- Los triggers se instalan de forma idempotente en database/security/apply-grants.sh.
-- MySQL con binary logging exige que esa operación la ejecute la cuenta administrativa,
-- sin conceder SUPER ni privilegios globales a la cuenta de migración de la aplicación.
SELECT 1;
