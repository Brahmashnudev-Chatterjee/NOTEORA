#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set app_password="$MARKETPLACE_APP_PASSWORD" \
  --set worker_password="$WORKER_PASSWORD" \
  --set migration_password="$MIGRATION_PASSWORD" \
  --set admin_password="$DATABASE_ADMIN_PASSWORD" \
  --file /docker-security/setup-roles.sql >/dev/null
