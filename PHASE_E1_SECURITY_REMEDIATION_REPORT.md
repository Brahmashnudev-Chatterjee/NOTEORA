# Phase E.1 - security and deployment remediation

Delivered2026-11-13, development only. **Application dependency remediation and the documented checks are complete. Production approval remains blocked by container findings and historical export exposure.** Phase F/provider integration has not begun. No production database, real credentials, UPI, funds, settlements or payouts were used.

## Results

- All four application npm trees now report **0 vulnerabilities**, both full and omit-dev. Trivy independently reports0 for the four lockfiles. Root/server/gateway previously had17 advisory package nodes representing six underlying advisories; the frontend was already0. No audit suppression or severity exclusion was used.
- Prisma/@prisma/client are aligned at6.19.3. A scoped @prisma/config override installs deepmerge-ts8.0.2; Prisma7/8 was avoided. Vitest4.1.12 is the necessary test-tool major upgrade because no patched3.x release existed; Vite remains7.3.7. Root/server Effect resolves to3.21.0. Compatible CLI/configuration loading, generation, validation, migrations and all regression suites passed.
- **182 distinct automated tests passed**, with all20 browser cases executed separately from ordinary-suite guards. All three builds and Prisma validation passed. Clean root/server/gateway lockfile installations with npm11.21.2 also passed.
- Remote base-image scanning was actually executed. It found **300 package/advisory occurrences:3 critical,83 high,127 medium,67 low,20 unknown**. Runtime tool removal/OS refresh is prepared, but built-image validation was impossible without a container engine. These findings remain open; npm0 does not clear them.
- A redacted Git-history scan found two authentication-material matches in an old database export. All16 export JSON files were removed from the Git index/build context while retained unchanged locally. Historical exposure/possible revocation remains an owner-reviewed gate. No destructive history rewrite or production account changes occurred.

## Advisory details and security decisions

[Dependency advisory register](DEPENDENCY_ADVISORY_REGISTER.md) and its [331-row CSV](DEPENDENCY_ADVISORY_REGISTER.csv) list package/version, vulnerable range, severity, identifier, direct/transitive relationship, patched version, affected component, recommendation and risk/evidence. Parent package propagation is distinguished from the underlying advisory; container package graph directness is not invented where the scanner does not establish it.

Resolved advisories cover tinypool prototype-pollution/RCE findings, Vitest/mocker traversal/manual-mock injection, deepmerge recursion exhaustion and Effect context contamination. The scoped merge replacement crosses a transitive major intentionally; upstream Map/deepmergeInto/type changes were reviewed, this application has no such config usage, and the actual Prisma configuration loader plus all applicable CLI/database checks passed. This is a maintained compatibility assumption requiring future rescans, not a vendor backport claim.

Initial npm10 upgrades failed with an Arborist `edgesOut` error and left old dependencies installed. Those initial tests were not used as patched-version evidence. Isolated npm11.21.2 completed the upgrades; packageManager, CI and image-builder tooling now pin that resolver. Final logs show Vitest4.1.12. Vitest4's test-discovery change initially collected stale compiled tests; source-only include patterns now prevent duplicate counts and production builds exclude test files. A dynamic cross-service test import was adapted to absolute file URLs for Vitest4. No acceptance assertions were removed.

Critical container occurrences are CVE-2025-68121 in bundled gosu/Go stdlib in Mongo/PostgreSQL and CVE-2026-111497 in the nginx base's brotli-libs. Other Go tools, mongosh YAML dependencies, global npm/Corepack and OS packages are fully retained in the register. Removing unused global Node package managers from final runtime layers and applying available OS updates is staged in Dockerfiles; it has **not** been certified by rebuilding/rescanning. Compiled vendor utilities need patched vendor bundles or a validated custom rebuild. An unreviewed Mongo/PostgreSQL major upgrade was not justified. Exact open risks and compensating controls remain documented; exploitability is not declared absent.

## Implemented deployment controls

Shared `security/runtime.mjs` enforces exact production HTTPS origins, explicit bounded proxy trust, strong signing/encryption secrets, authenticated TLS database/Redis settings and HTTPS administrator introspection. Production HTTP is rejected except minimal liveness; cookie security remains Secure/HttpOnly/SameSite=Strict. Actual TLS certificates/infrastructure are not provisioned or tested here.

API/header tests exercise CORS denial, JSON size limits, malformed-body sanitization, security headers, rate limiting, HTTPS/proxy policy, no-store responses and nested log redaction. Raw Prisma error logging is disabled; worker failures no longer emit job data/raw error text. Existing session/reset/refresh/revocation and merchant-admin isolation tests pass. Same-origin gateway proxy configuration rewrites the refresh-cookie path; Nginx/container routing still requires real container verification.

Marketplace BullMQ now honors REDIS_URL, including encoded credentials and TLS/database selection; gateway uses its separate URL. Redis Compose setup no longer passes the password in process arguments and requires a random hex secret. APIs/workers have bounded shutdown handling and readiness/liveness/heartbeat logic. A real listener drain and heartbeat cleanup are tested; process-signal/container shutdown and monitoring are not certified.

Dedicated gateway API/worker SQL grants were applied only to disposable databases. Actual auth/merchant/queue/browser tests use the restricted identities. API cannot read marketplace/payment tables or create schema objects; worker cannot read team/credential tables; neither has administrative role attributes. ORM audit INSERT RETURNING requires SELECT, while UPDATE/DELETE remain denied/trigger-protected. Schema changes grant no future tables automatically. Existing production roles were not altered.

Dockerfiles now use root build contexts, locked installs, production-only output, pruned development packages, non-root runtime users, pinned scanned bases and private-context exclusions. The gateway-worker command now starts the worker rather than another API. Compose binds development ports to loopback, drops application/Redis capabilities and sets init/grace periods. Static web delivery replaces a development-server image; it has security headers and explicit proxy configuration. Linux shell line endings are preserved without renormalizing historical migration SQL.

Portable Docker Compose5.7.1 validated configuration with test-only values. **No Docker engine/build/container startup or production deployment was executed.** PostgreSQL/Mongo upstream privilege/volume initialization, Nginx behavior, binary backup helper execution and rebuilt-image scans remain required. The main Compose stack is explicitly development only; its default standalone Mongo needs the separately approved replica-set configuration for financial/upload transactions. No existing volume was deleted/reinitialized.

Full statuses and commands: [deployment checklist](DEPLOYMENT_SECURITY_CHECKLIST.md).

## Migration findings and recovery

The underlying problem is historical directory ordering: Prisma tries Phase5C before Phase5B, so an enum dependency is missing. It is not a missing extension or schema-generation issue. Old migration names/checksums were preserved.

`scripts/deploy-development-schema.mjs` is the explicit shared development/CI procedure. It requires a loopback DEV_DATABASE_URL ending `_test`/`_development`, serializes bootstrap, checks tables/history/checksum and refuses failed or untracked schemas. Only an empty DB receives the exact tracked baseline via Prisma db execute; after success it records that actually applied baseline, then uses normal migrate deploy. It never marks missing SQL applied or silently resets history.

The verifier reproduced bare deployment failure in another disposable DB, then confirmed that failed history is rejected. Nonlocal and nonempty/untracked targets were rejected. Fresh and repeated guarded deployment passed. All16 gateway application tables matched after logical backup/restore into a second fresh, fully migrated DB. These checks are additional executed assertions, not extra Vitest cases added to the182 count.

No new application schema migration was added in E.1. Database changes are reviewed role/grant provisioning in isolated development only. The Phase E migration remains unchanged. No automatic down migration is provided; recovery is restore-to-new plus validation and separately approved connection changes. The binary backup helper now requires an explicit isolated source and a unique fresh restore destination instead of dropping a fixed DB; it was reviewed/prepared but not run without Docker. Production/PITR/roles/keys/backup recovery remains unverified. See [migration bootstrap procedure](MIGRATION_BOOTSTRAP.md).

## Exact test evidence

| Executed check | Result |
|---|---|
| Marketplace backend/MongoDB suite | **111 passed**,20 guarded browser cases skipped in this invocation |
| Gateway ordinary suite | **20 passed**,26 guarded service cases skipped in this invocation |
| Gateway full suite with PostgreSQL/Redis/runtime roles | **46 passed**; includes the same20 ordinary cases, not counted twice |
| Marketplace PostgreSQL schema suite | **5 passed** |
| Authentication browser | **2 passed** |
| Marketplace/seller/admin browser | **9 passed** |
| Subscription/financial browser | **4 passed** |
| Gateway browser with real MongoDB/PostgreSQL/Redis | **5 passed** |
| Frontend/backend/gateway builds | All passed; frontend bundle-size warning remains |
| Prisma schema/client generation/config loader | Passed |
| Full and omit-dev npm audits |0 in root/server/client/gateway |
| Trivy lockfile scan |0 across four lockfiles |
| Trivy remote base-image scans | Executed; open findings above, not passed security gates |
| Fresh/repeat/refusal/recovery checks | Passed; expected bare-deploy failure reproduced only in disposable DB |
| Logical fixture restore |16 gateway application tables matched |
| Compose configuration | Passed via portable CLI; no daemon/build test |
| Redacted secrets scans |19 historical commits:2 findings; initial working tree:3 findings including one evidence-checksum false positive |

Distinct automated total =111 +46 +5 +2 +9 +4 +5 = **182**. The182 counted cases are source tests; stale compiled duplicates are excluded. Existing application behavior remains intact within executed coverage. This does not certify future payment/provider workflows or complete production readiness.

Logs/JSON: [test/evidence directory](docs/evidence/phase-e1/), especially `server-tests.log`, `gateway-tests.log`, `postgres-browser-tests.log`, the three existing-browser logs, build/validation/generation/config logs, before/after/runtime audit JSON, source lockfile scan, five image reports and redacted secrets reports. Browser suites refresh their Phase C/D/E screenshots using synthetic fixtures; no external webhook receiver or real payment was used.

[Verified counts and log checksums](docs/evidence/phase-e1/verification-summary.json) prevent duplicate gateway counts. Current browser evidence copies: [approved review](docs/evidence/phase-e1/screenshots/admin-approved.png), [viewer mobile](docs/evidence/phase-e1/screenshots/viewer-mobile.png), [signed test delivery](docs/evidence/phase-e1/screenshots/webhook-delivered.png).

Reproduce with the commands in the checklist and migration document. The complete isolated verifier command is:

```powershell
npm.cmd install --prefix "$env:TEMP\noteora-phase-c-pg" embedded-postgres@16.15.0-beta.19
$env:NOTEORA_REDIS_BINARY='absolute-path-to-portable-redis-server'
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:RUN_GATEWAY_BROWSER='1'
node scripts/verify-phase-e1-postgres.mjs
Remove-Item Env:RUN_GATEWAY_BROWSER
```

It creates a fresh local PostgreSQL16.15 cluster and password-protected temporary Redis7.4.2 instance on random ports, creates disposable DB fixtures, provisions restricted roles, runs suites/restores and stops both services. Existing browser scripts use RUN_AUTH_BROWSER/RUN_MARKETPLACE_BROWSER/RUN_FINANCIAL_BROWSER. No existing DB URL is accepted by the verifier. Remote GitHub Actions was updated but not executed.

## Files and packages

Phase E changes were already present and uncommitted at the start of E.1; cumulative Git status includes them. E.1 changes are:

- Dependency/tooling manifests and locks: root, server and gateway package.json/package-lock.json; client packages remain unchanged/audited. Prisma/client6.19.3, Vitest4.1.12, explicit existing Vite7.3.7, scoped deepmerge-ts8.0.2 override, Effect3.21.0 via Prisma, npm11.21.2 tooling.
- New shared `security/runtime.mjs`/`runtime.d.mts`; updated server index, Prisma/queue infrastructure and workers; gateway index, worker and workerMain.
- New server deployment-security and gateway request/runtime-role tests; updated Vitest configs, persistent auth/merchant/queue harnesses and cross-service browser harness.
- New `scripts/deploy-development-schema.mjs`, `scripts/verify-phase-e1-postgres.mjs`; hardened `scripts/postgres-backup-restore.ps1`.
- New `database/security/gateway-runtime-grants.sql`; updated `setup-roles.sql`/`10-setup-roles.sh`. No E.1 data/schema migration or production grant execution.
- Updated all three Dockerfiles, Compose files, `.github/workflows/ci.yml`, root/server/gateway environment examples; new `deployment/redis-start.sh`, `client/nginx.conf`, `.dockerignore`, `.gitattributes`; updated `.gitignore`.
- All16 `database/export/*.json` removed from tracking but preserved unchanged locally; [secret review](SECRET_FINDINGS.md) explains the staged removals and history limitation.
- This report, advisory MD/CSV, deployment checklist, migration document, secret findings, updated security/implementation/remaining-work audits and README; new evidence under `docs/evidence/phase-e1/`. Prior screenshot evidence is refreshed by regression suites.

## Remaining risks and stopping point

1. **Container critical/high findings remain open** until patched vendor/custom images, actual builds, rescans and runtime checks pass. Prepared Dockerfile changes are not sufficient evidence of resolution.
2. **Historical export authentication material remains in Git history.** Validity/provenance review, any real revocation and coordinated approved history cleanup are outstanding. Local files were preserved; no production identity was changed.
3. Actual TLS/secret-manager/DB/Redis ACL deployment, volume permissions, distributed rate limits, monitoring/log retention, external audit retention, full backups/PITR/key recovery and recovery timing remain infrastructure work. No production readiness claim.
4. The historical migration ordering is explicit and repeatable in development through the guarded procedure. Production history/recovery needs separate approval; no destructive resets/renames/cutover were performed.
5. Real SMTP/invitation delivery, tax/legal/provider decisions and future payment/refund/payout requirements remain outside E.1. The large frontend bundle warning remains; container/browser load/accessibility and remote CI were not certified.

**Stopped after Phase E.1.** Resolve/review the open image/history/deployment gates before approving further integration. Await explicit approval before Phase F; no provider integration was started.
