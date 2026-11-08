# Database Security — Phase 5B.1

## PostgreSQL roles

- `noteora_app`: application CRUD; no superuser, create-database, create-role or schema-management privilege.
- `noteora_worker`: restricted read/write worker access; no schema creation or migration privilege.
- `noteora_migrator`: migration and schema privileges limited to controlled migration operations.
- `noteora_admin`: non-superuser operational administration role.
- `noteora_dev`: container initialization/administration role and not the application runtime identity.

The role policy is implemented in `database/security/setup-roles.sql` and applied by `database/security/10-setup-roles.sh`. Passwords are supplied through Docker environment variables. No password is stored in documentation or application logs.

## Network and secret controls

PostgreSQL and MongoDB bind to `127.0.0.1`; Redis also binds to localhost and requires a password. The `.env` file is ignored by Git. Redis credentials and database passwords must remain environment-provided.

## Worker security

BullMQ uses exponential backoff and failed-job retention. Each queue supports explicit idempotency keys through `addIdempotentJob`; BullMQ reuses the same job ID instead of creating duplicate work. Payment financial operations are not executed by current placeholder queue processors and require provider-side and database transaction authorization before Phase 5C.

## Audit and backup limitations

The migration path records structured errors and reconciliation totals. Routine database audit-log retention and external secret-manager integration remain deployment-stage work.
