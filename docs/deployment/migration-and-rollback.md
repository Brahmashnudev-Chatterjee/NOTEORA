# MongoDB to PostgreSQL Migration and Rollback Guide

## Safety constraints

- MongoDB is the source of record during Phase 5A.
- No production traffic is switched automatically.
- Migration scripts never update, delete or drop MongoDB records.
- PostgreSQL writes occur inside one database transaction for the full import.
- A failed import rolls back the entire PostgreSQL transaction.
- Gateway records are imported only after merchant identity mapping is approved.

## Prerequisites

1. Start and backup the source MongoDB instance.
2. Configure `MONGO_URI` in the migration shell only.
3. Configure a PostgreSQL migration-only role and `DATABASE_URL`.
4. Apply Prisma migrations to a non-production PostgreSQL database.
5. Review the migration mapping document.
6. Confirm GST and financial assumptions are frozen for reconciliation purposes.

## Export

```powershell
npm run db:export
```

This creates JSON exports under `database/export` for every existing collection. Record SHA-256 hashes of the export directory and retain MongoDB backup metadata.

## Dry run and transformation

```powershell
npm run db:migrate:dry
```

Dry-run mode:

- Reads every exported collection.
- Validates required fields and price limits.
- Reports broken ObjectId references.
- Computes exported ledger and paid-order totals.
- Writes `database/migration-report.json`.
- Does not create PostgreSQL records.

Exit code 2 means migration validation failed.

## Repeated trial imports

```powershell
copy database\migration-report.json database\migration-dry-run-report.json
$env:DATABASE_URL="postgresql://migration_user:...@localhost:5432/noteora_trial"
npm run db:migrate
```

This writes PostgreSQL data only when `DATABASE_URL` is present. Before accepting the trial:

1. Compare collection counts.
2. Verify UUID/`legacyId` uniqueness.
3. Check all order, buyer, seller and material foreign keys.
4. Reconcile SellerLedger totals with paid MongoDB orders.
5. Ensure Live and Sandbox records are isolated.
6. Verify every refunded record has `providerConfirmed=false` unless an actual provider confirmation was independently verified.

## Verification gates

Migration only passes when all are true:

- Export count equals PostgreSQL source count for every mapped collection.
- No unresolved foreign-key references remain.
- Duplicate email, slug and seller/order ledger constraints are zero.
- Historical money totals match to two decimal places.
- Paid PDF orders have the correct approved materials.
- No webhook event is marked processed if signature and sequence verification did not complete.
- Live records do not appear in sandbox result sets and vice versa.

## Rollback strategy

### Before traffic switch

1. Stop migration writer processes.
2. Drop or rename the PostgreSQL migration schema/database.
3. Leave MongoDB unchanged and continue existing traffic.
4. Delete generated export files only after an approved retention period.

### After a PostgreSQL test switch

1. Route traffic back to the existing MongoDB Express API using environment configuration.
2. Disable write mode for the PostgreSQL services.
3. Capture failed or diverged PostgreSQL transaction logs.
4. Do not overwrite MongoDB from PostgreSQL.
5. Export the PostgreSQL delta only for engineering review; replay is a separately approved Phase 5B operation.

## Recovery principles

- MongoDB remains the authoritative recovery source until PostgreSQL reconciliation is signed off.
- PostgreSQL imports are replayable through legacy IDs.
- No migration deletes files from private upload storage.
- PDF object migration is separate and requires content/hash verification.

## Retention

Retain exports, migration reports, backup IDs, record-count checks and reconciliation hashes according to the production data-retention policy. Financial exports require restricted access and encryption at rest.
