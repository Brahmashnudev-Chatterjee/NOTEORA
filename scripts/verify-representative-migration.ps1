$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
node server/scripts/create-migration-fixtures.mjs database/migration-fixtures

docker compose exec -T postgres dropdb --if-exists -U noteora_dev noteora_migration_verify
docker compose exec -T postgres createdb -U noteora_dev noteora_migration_verify
docker compose exec -T postgres psql -U noteora_dev -d noteora_migration_verify -c 'CREATE SCHEMA IF NOT EXISTS marketplace; CREATE SCHEMA IF NOT EXISTS gateway;'
docker compose cp database/prisma/migrations/20261108175257_phase5b/migration.sql postgres:/tmp/phase5b.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U noteora_dev -d noteora_migration_verify -f /tmp/phase5b.sql

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U noteora_dev -d noteora_migration_verify -c 'GRANT CONNECT ON DATABASE noteora_migration_verify TO noteora_migrator, noteora_app; GRANT USAGE ON SCHEMA gateway TO noteora_migrator; GRANT USAGE, CREATE ON SCHEMA marketplace TO noteora_migrator; GRANT USAGE ON SCHEMA marketplace TO noteora_app; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA marketplace TO noteora_migrator; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA marketplace TO noteora_migrator; ALTER DEFAULT PRIVILEGES FOR ROLE noteora_dev IN SCHEMA marketplace GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO noteora_migrator;'

$env:DATABASE_URL='postgresql://noteora_migrator:noteora_migrator_dev_password@127.0.0.1:5432/noteora_migration_verify?schema=marketplace'
node server/scripts/migrate-mongodb-to-postgres.mjs --input=database/migration-fixtures --report=database/migration-fixture-report.json

docker compose cp database/migration-verification.sql postgres:/tmp/migration-verification.sql
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U noteora_dev -d noteora_migration_verify -f /tmp/migration-verification.sql
