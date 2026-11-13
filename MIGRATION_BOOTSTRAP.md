# Migration bootstrap and recovery - Phase E.1

## Cause

This is a historical **migration-directory ordering/dependency defect**, not missing PostgreSQL extensions, an application payment dependency or a Prisma schema-generation failure. Prisma orders `20261108_phase5c` before `20261108175257_phase5b`. Phase5C immediately renames an enum created by Phase5B; on an empty DB it fails with P3018/PostgreSQL42704 (`gateway.MerchantStatus` missing).

The defect was reproduced again on a new disposable `noteora_ordering_failure_test` database. The guarded helper then rejected that failed history rather than silently marking it fixed. Names/checksums of existing migration files were preserved; no deployed history was renamed, reset, deleted or rewritten.

## Approved development procedure

`scripts/deploy-development-schema.mjs` is the shared, reviewable entrypoint used by the Phase E.1 verifier and CI. It requires **DEV_DATABASE_URL**, never falls back to DATABASE_URL, and accepts only explicit loopback databases ending `_test` or `_development`. It is not an approved production deployment tool.

```powershell
$env:DEV_DATABASE_URL='postgresql://development_migrator:<secret>@127.0.0.1:5432/noteora_gateway_test?schema=gateway'
node scripts/deploy-development-schema.mjs
# A second invocation verifies there are no pending migrations:
node scripts/deploy-development-schema.mjs
Remove-Item Env:DEV_DATABASE_URL
```

Use a secret manager/process environment, not a real password pasted into tracked scripts or shell history. The URL above is a template, not a real credential.

The helper takes a PostgreSQL advisory transaction lock, inspects application tables and Prisma history, rejects failed/untracked history and compares the recorded baseline checksum with the tracked SQL file. For a genuinely empty development DB only, it executes the exact tracked baseline using Prisma db execute, and **only after successful SQL execution** records that baseline with migrate resolve. It then runs normal migrate deploy. A repeat invocation validates the existing baseline and runs deploy without reapplying SQL. No undocumented manual SQL or false applied marker is used.

Known partial failure: if baseline SQL succeeds but its history-recording command fails, the helper stops. A subsequent nonempty/untracked database is deliberately rejected. Do not rerun with bypass flags or manually mark migrations applied without evidence. Recreate a fresh disposable development database for tests, or request a reviewed existing-database recovery plan.

The safety guard is not proof that any localhost proxy is non-production. The operator must ensure the target is the intended isolated database. The verifier itself creates its databases on a new temporary PostgreSQL instance/random port with generated credentials and never accepts an existing DB URL.

## Executed verification

- Fresh exact baseline plus remaining migrations succeeds; repeated deploy has no pending changes.
- Non-loopback/non-development URL is rejected before connection.
- A deliberately nonempty/untracked fresh fixture DB is rejected.
- Bare Prisma deployment reproduces the original ordering defect in another disposable DB; its failed history is then rejected by the helper.
- Real merchant/auth/queue/browser suites execute with separately provisioned runtime roles after migration/grants.
- A logical fixture backup of all16 gateway application tables restores identically into a second fresh, fully migrated DB. This excludes Prisma metadata; the destination obtains valid metadata through the same tested migration procedure.

Evidence: [combined migration/database/browser log](docs/evidence/phase-e1/postgres-browser-tests.log). The expected isolated P3018 reproduction in that log is not an unresolved test failure. No existing or production database was connected or modified.

## Recovery and production gate

No destructive down migration is supplied. Stop writes, preserve migration logs/checksums and take a verified backup before any separately approved existing-database change. Recover to a new database from a known-good backup, verify schema/history/data and application behavior, then obtain approval before changing any connection/cutover. Never erase `_prisma_migrations`, run migrate reset on real data, rename previously deployed migration directories or mark unexecuted SQL applied.

The logical restore check is not binary/PITR/roles/grants recovery certification. The guarded binary backup helper, encrypted storage, key recovery, RTO/RPO and production rollback/cutover must be tested separately. MongoDB remains marketplace authority; this gateway migration procedure grants no marketplace cutover approval. The historical naming limitation remains explicit; the repeatable development bootstrap is implemented/tested, while a production rollout still needs its own reviewed history and recovery plan.

## Phase E.2 rerun

`docs/evidence/phase-e2/postgres-browser-tests.log` records another actual fresh/repeated deployment, expected bare-deploy ordering failure, rejected unsafe/history states and16-table logical restore, followed by the gateway/schema/browser tests. No schema or migration files were changed in E.2. The patched PostgreSQL16 Docker image additionally passed a synthetic custom-format pg_dump/pg_restore roundtrip into a newly created disposable database; evidence is `container-postgres-restore-retry.log`. The initial attempt's `pg_isready` check reached the temporary initialization server before POSTGRES_DB existed; the retry checked SELECT1 against the actual target database. This narrower single-fixture custom-format test does not certify production roles, encrypted backup custody, PITR or disaster recovery.
