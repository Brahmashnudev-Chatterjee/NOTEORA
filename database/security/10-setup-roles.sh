#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --file /docker-security/setup-roles.sql >/dev/null
