\getenv app_password MARKETPLACE_APP_PASSWORD
\getenv worker_password WORKER_PASSWORD
\getenv migration_password MIGRATION_PASSWORD
\getenv admin_password DATABASE_ADMIN_PASSWORD
\getenv gateway_password GATEWAY_APP_PASSWORD
\getenv gateway_worker_password GATEWAY_WORKER_PASSWORD
CREATE SCHEMA IF NOT EXISTS marketplace;
CREATE SCHEMA IF NOT EXISTS gateway;

SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname='noteora_app') THEN
  format('ALTER ROLE noteora_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION', :'app_password') ELSE
  format('CREATE ROLE noteora_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION', :'app_password') END \gexec
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname='noteora_worker') THEN
  format('ALTER ROLE noteora_worker LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION', :'worker_password') ELSE
  format('CREATE ROLE noteora_worker LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION', :'worker_password') END \gexec
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname='noteora_migrator') THEN
  format('ALTER ROLE noteora_migrator LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION', :'migration_password') ELSE
  format('CREATE ROLE noteora_migrator LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION', :'migration_password') END \gexec
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname='noteora_admin') THEN
  format('ALTER ROLE noteora_admin LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION', :'admin_password') ELSE
  format('CREATE ROLE noteora_admin LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION', :'admin_password') END \gexec

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE :"DBNAME" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"DBNAME" TO noteora_app, noteora_worker, noteora_migrator, noteora_admin;
GRANT USAGE ON SCHEMA marketplace TO noteora_app, noteora_worker, noteora_migrator, noteora_admin;
GRANT USAGE ON SCHEMA gateway TO noteora_app, noteora_worker, noteora_migrator, noteora_admin;
GRANT CREATE ON SCHEMA marketplace, gateway TO noteora_migrator, noteora_admin;
GRANT CREATE ON SCHEMA public TO noteora_migrator, noteora_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA marketplace TO noteora_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA marketplace TO noteora_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA marketplace TO noteora_app, noteora_worker;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA marketplace TO noteora_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA marketplace TO noteora_admin;
REVOKE ALL ON ALL TABLES IN SCHEMA gateway FROM noteora_app, noteora_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA gateway TO noteora_app, noteora_worker;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA gateway TO noteora_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA gateway TO noteora_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE noteora_migrator IN SCHEMA marketplace
  GRANT SELECT, INSERT, UPDATE ON TABLES TO noteora_app, noteora_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE noteora_migrator IN SCHEMA marketplace
  GRANT USAGE, SELECT ON SEQUENCES TO noteora_app, noteora_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE noteora_migrator IN SCHEMA gateway
  GRANT SELECT ON TABLES TO noteora_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE noteora_migrator IN SCHEMA gateway
  REVOKE ALL ON TABLES FROM noteora_app;
ALTER DEFAULT PRIVILEGES FOR ROLE noteora_migrator IN SCHEMA gateway
  REVOKE ALL ON TABLES FROM noteora_worker;
ALTER DEFAULT PRIVILEGES FOR ROLE noteora_migrator IN SCHEMA gateway
  GRANT USAGE, SELECT ON SEQUENCES TO noteora_app, noteora_worker;

-- Dedicated gateway roles get table-specific grants only after reviewed migrations.
SELECT format('CREATE ROLE noteora_gateway_api LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', :'gateway_password') WHERE NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='noteora_gateway_api') \gexec
SELECT format('CREATE ROLE noteora_gateway_worker LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', :'gateway_worker_password') WHERE NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='noteora_gateway_worker') \gexec
GRANT CONNECT ON DATABASE :"DBNAME" TO noteora_gateway_api,noteora_gateway_worker;
