# Phase E - gateway merchant management

Delivered 2026-11-13 in isolated development services. **Phase E is complete within the management/test-infrastructure scope below. The application is not production-ready. Phase F and provider integration have not begun.** No production data, live credentials, customer funds, UPI, settlements or payouts were used.

## Implementation

### Merchant lifecycle and administrator controls

Registration creates a PENDING merchant and hashed owner identity transactionally. The console exposes business/contact profile management and actual stored status. APPROVED business identity changes return the merchant to UNDER_REVIEW. Administrators search/page/filter merchants, inspect details, review pending applications and approve/reject/suspend/disable/reactivate with a required reason and expected current status. Status changes and audit entries commit together; conflicting reviews fail409. Status counts now correctly total partially populated status groups.

PENDING/UNDER_REVIEW can use onboarding console functions but cannot provision credentials or send tests. REJECTED/SUSPENDED/DISABLED blocks sessions and credential access; transitions revoke existing sessions. Reactivation requires fresh login. Status is enforced by the API and worker, not a display-only label. Administrative approval does not establish KYC verification or regulatory authorisation.

Administrators remain marketplace ADMIN/SUPER_ADMIN sessions, introspected on each request against the trusted marketplace API. Merchant tokens/shared browser secrets cannot authenticate administrators. The dashboard sends the appropriate marketplace authentication header; backend actions recheck authorization.

### Merchant teams

Owners/admins create single-use48-hour invitations with cryptographically random tokens stored only as hashes. Acceptance binds the preselected merchant/email/role and lets the recipient choose their own password. Expired, revoked and reused invitations fail. Reissue revokes prior unused invitations for that merchant/email. The UI returns a secure-sharing token/link once, explicitly without claiming email delivery; links use fragments.

Owner/admin/developer/viewer roles are enforced server-side. Only owners appoint/manage owner/admin targets; admins manage developers/viewers. Developers configure keys/webhooks; viewers read. Team changes/revocations invalidate sessions, and the last active owner cannot be removed/demoted. Merchant row locks serialize privileged mutations. Target IDs are scoped to the authenticated merchant. Revoked member access is not automatically restored through invitation reuse.

### API credentials

Keys/secrets use32 random bytes each and are stored only as SHA-256 hashes. Plaintext is returned only on generation, with no-store headers; listings and administrator oversight expose metadata only. Per-environment creation/rotation atomically revokes the prior active credential, stamps revocation dates and records audit events. Concurrent rotations leave one active key. Explicit future expiration, revocation, merchant approval and exact environment are checked on every authenticated request.

Reusable API-key middleware protects `/integration/context`; `/credentials/verify` uses the same checks. SANDBOX returns only the authenticated merchant context and paymentsEnabled:false. LIVE keys may be provisioned as metadata, but **live resource access always fails**. No payment-processing endpoint was added.

### Webhook management and delivery

Owned endpoint registration/edit/disable and event-subscription management work through API/UI. Secrets use compatible AES-256-GCM encryption plus a hash; only configuration responses reveal plaintext once. Saving configuration rotates the secret. Only gateway.test subscriptions/production of test events are available; attempted payment-success subscriptions are rejected.

HTTPS, URL credentials/fragments, DNS and address safety are checked at registration and before sending. Requests pin the checked address, keep hostname/TLS verification, reject redirects and do not store response bodies. Private/mapped/loopback/metadata destinations are denied unless an exact local origin is explicitly allowed outside production. Production ignores that development exception.

Atomic event/delivery/outbox records survive queue interruption. An opt-in BullMQ/Redis worker recovers due deliveries, claims PostgreSQL leases, signs exact raw JSON with timestamped HMAC, records each attempt and retries failures with backoff. At most five sends are attempted; terminal failure/cancellation is visible. Worker interruption records unknown outcomes and never invents success. Receiver event-ID deduplication is required because network delivery is at least once. Concurrent duplicate test requests and delivery claims are tested. The only generated payload is clearly labelled gateway.test/test:true and has no transaction.

### Audit integrity and interfaces

Merchant/admin dashboards now expose functional profile, teams, credential rotation/revocation, webhook configuration/subscriptions, test delivery, attempt history, activity and integration documentation. Pending/empty/loading/error/success states are present. Viewer mobile behavior is exercised. One-time secrets can be dismissed and are not included in screenshots.

Mutations commit audit records with their changes. SQL protection rejects ordinary GatewayAuditLog UPDATE/DELETE; the existing merchant FK may detach merchantId after actual merchant deletion while preserving other history. Tests attempt SQL history forgery/deletion and verify rejection. Superusers can bypass triggers; operational least privilege and external retention remain necessary.

## Actual verification

| Executed check | Result |
|---|---|
| Ordinary marketplace backend suite | **102 passed**, 20 guarded browser cases skipped in this invocation |
| Ordinary gateway suite | **17 passed**, 23 guarded PostgreSQL/Redis cases skipped in this invocation |
| Gateway authentication on disposable PostgreSQL | **4 passed** |
| Marketplace PostgreSQL schema integration | **5 passed** |
| Merchant-management PostgreSQL integration | **18 passed**, including audit SQL protection |
| Real Redis/BullMQ + PostgreSQL + HTTP retry integration | **1 passed**, recovers queued work and retries503 before signed delivery |
| Existing authentication Chrome browser | **2 passed** |
| Existing marketplace/seller/admin Chrome browser | **9 passed** |
| Existing subscription/financial Chrome browser | **4 passed** |
| New gateway Chrome browser | **5 passed**, real MongoDB/PostgreSQL/Redis/API services |
| Marketplace backend, frontend, gateway builds | All passed |
| Prisma schema validation and generated clients | Passed |
| Fresh/repeated guarded Prisma deployment | Passed on a fresh disposable database |
| Logical fixture backup/restore | **All16 gateway tables matched** in a second newly migrated database |
| `git diff --check` | Passed |

**167 distinct tests passed.** Skips are not counted as passes; their explicit service/browser invocations are listed separately. PostgreSQL/Redis cases total28; browser cases total20. Gateway ordinary auth tests use mocked persistence; persistent tests separately use real PostgreSQL. MongoDB marketplace authority and prior financial controls remain intact within the regression coverage. No blanket certification of incomplete future features is implied.

PostgreSQL integration covers registration, real session state, approval/rejection/stale review, reasons, disabled/suspended accounts, profile review reset, role boundaries, invitations/expiry/reuse/revocation, session invalidation, last-owner protection, merchant isolation, key hashing/rotation/expiry/revocation/environment restrictions, URL safety, encrypted secrets, real HTTP signatures, duplicate events/claims, failed attempts/backoff/terminal tracking, audit integrity and administrator authorization. Browser coverage adds actual onboarding/approval, invitation acceptance/viewer mobile UI, one-time key configuration, Redis webhook delivery, oversight and suspension. Crypto tests cover encryption tampering, signatures, exact-body binding, timestamp tolerance and production rejection of local URL bypass.

The initial browser harness exposed test URL/selector problems and dashboard status-refresh behavior; those were corrected and the final five-case suite passed. The final recorded run also repeats database tests after audit-trigger protection was added. Missing DATABASE_URL initially prevented standalone schema validation; rerunning with an explicit nonconnecting validation-only test URL passed. No failed attempt is represented as a successful result.

### Evidence

- [Verified counts and log checksums](docs/evidence/phase-e/verification-summary.json); the ordinary17 gateway cases are included in the combined40 and are not counted twice.
- [Combined final PostgreSQL/Redis/gateway-browser/migration/restore log](docs/evidence/phase-e/postgres-browser-tests.log).
- [Backend](docs/evidence/phase-e/server-tests.log), [ordinary gateway](docs/evidence/phase-e/gateway-tests.log).
- [Auth browser](docs/evidence/phase-e/auth-browser.log), [marketplace browser](docs/evidence/phase-e/marketplace-browser.log), [financial browser](docs/evidence/phase-e/financial-browser.log).
- [Pending merchant](docs/evidence/phase-e/merchant-pending.png), [approved administrator review](docs/evidence/phase-e/admin-approved.png), [viewer on mobile](docs/evidence/phase-e/viewer-mobile.png), [signed test delivery](docs/evidence/phase-e/webhook-delivered.png), [suspension history](docs/evidence/phase-e/admin-suspended.png).
- Build and Prisma-validation logs, [fresh dependency audit](docs/evidence/phase-e/gateway-dependency-audit.json) and [omit-dev audit](docs/evidence/phase-e/gateway-runtime-audit.json) reside in the same evidence directory.

Screenshots, keys, events and restore data are synthetic fixtures exclusively in isolated development services. No external merchant received a test; HTTP receivers were local. Redis7.4.2 was run from a portable community Windows distribution solely for these tests; Linux CI uses the existing Redis7 container. No Docker deployment, remote Actions run, external HTTPS receiver, live provider, load test or full disaster recovery exercise was executed.

## Commands and reproducibility

Node22.14.0/npm and installed Chrome were used locally. PowerShell uses `npm.cmd` because npm.ps1 execution is disabled. Configure only test services/values; do not use production environment files.

```powershell
npm.cmd --prefix gateway-api ci
npm.cmd --prefix gateway-api run prisma:generate
npm.cmd --prefix gateway-api test
npm.cmd --prefix server test
npm.cmd --prefix server run build
npm.cmd --prefix client run build
npm.cmd --prefix gateway-api run build
$env:DATABASE_URL='postgresql://validation_only:unused@127.0.0.1:5432/noteora_validation_test?schema=gateway'
npm.cmd run prisma:validate
npm.cmd install --prefix "$env:TEMP\noteora-phase-c-pg" embedded-postgres@16.15.0-beta.19
$env:NOTEORA_REDIS_BINARY='absolute-path-to-portable-redis-server'
$env:RUN_GATEWAY_BROWSER='1'
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
node scripts/verify-phase-e-postgres.mjs
Remove-Item Env:RUN_GATEWAY_BROWSER
$env:RUN_AUTH_BROWSER='1'
npm.cmd --prefix server run test:auth-browser
Remove-Item Env:RUN_AUTH_BROWSER
$env:RUN_MARKETPLACE_BROWSER='1'
npm.cmd --prefix server run test:marketplace-browser
Remove-Item Env:RUN_MARKETPLACE_BROWSER
$env:RUN_FINANCIAL_BROWSER='1'
npm.cmd --prefix server run test:financial-browser
Remove-Item Env:RUN_FINANCIAL_BROWSER
git diff --check
```

The gateway Prisma-generation script regenerates all configured root/server/gateway clients. Browser coverage uses Playwright with actual Chrome, temporary MongoDB replica sets and the runner's PostgreSQL/Redis credentials. The verifier creates random ports/passwords and never accepts an existing PostgreSQL database URL. Existing CI now applies the additional gateway migration and supplies the isolated Redis test URL so persistent queue tests can execute. Gateway test files run sequentially because their explicitly supplied disposable schema/queue is shared; this prevents a queue test worker claiming another test file's fixtures. The combined local service run executes all40 gateway cases; remote CI has not been run here.

## Database migration and backup detail

Additive gateway-only migration: `database/prisma/migrations/20261113_phase_e_merchant_management/migration.sql`.

- DISABLED merchant enum member.
- MerchantInvitation with merchant FK, unique tokenHash and merchant/email index.
- WebhookDelivery.leaseUntil and WebhookAttempt with unique delivery/attempt number.
- Append-only audit-history function/trigger, preserving only existing FK detach semantics.

No marketplace schema/data migration, production cutover, dual write, production index operation or destructive data rewrite was performed. Runtime does not silently apply migrations.

**Pre-existing migration-order defect:** bare Prisma migrate deploy on an empty database orders Phase5C before its baseline and fails. Existing migration names/history were preserved. The isolated verifier checks its own newly created database is empty, applies the exact baseline SQL, records that actually applied baseline using migrate resolve, then runs migrate deploy and repeat deploy. This is a documented development bootstrap, not a generic repair instruction for an existing database. A deployment with an existing/inconsistent history needs a separate reviewed plan.

The logical backup exports a repeatable-read snapshot of all16 gateway application tables (excluding Prisma migration history) to a temporary JSON file. Restore runs into a second fresh, fully migrated database in FK order and checks every exported row for equality. It includes synthetic credential/configuration/audit records from browser fixtures and a dedicated restore marker. This validates the application-table round trip, **not** pg_dump/PITR, roles/grants, encrypted offsite backups, secrets recovery or full production recovery. Temporary services are stopped; fixture files remain outside the repository for inspection.

## Security findings and remaining limitations

1. Fresh gateway npm audit reports **2 critical,3 high,1 moderate** advisory package nodes. Critical: vitest/tinypool; high: prisma/@prisma/config/deepmerge-ts; moderate: @vitest/mocker. Omit-dev still reports3 high nodes. These remain unresolved; no force upgrade/security-clear claim is made. BullMQ was added using the existing stack's version.
2. Invitations work through secure one-time sharing; SMTP invitation dispatch is not configured or claimed. Registration is administrative onboarding, not an operational KYC verification service. Revoked member accounts are not automatically reactivated by invitation reuse.
3. Live credentials are provisioning only; live API resources and webhook delivery are blocked. Only nonfinancial gateway.test events exist. Payment-order/provider/event producers remain Phase F and require explicit approval and legitimate arrangements.
4. Delivery is at least once. Receiver deduplication is mandatory; an in-flight send cannot be recalled after suspension/configuration changes. Pending tests use current claimed configuration/secret. Secret rotation must coordinate receiver configuration. Response bodies are intentionally not retained. UI lists the latest100 deliveries/activity/invitations; large-history pagination, retention, dead-letter operational tooling and monitoring remain future deployment work.
5. The historical fresh migration ordering still requires the guarded bootstrap. Existing deployment histories must not be renamed, reset or marked applied without evidence. Production migration/rollback and full backup/PITR are not approved or certified here.
6. Production DB/Redis least privilege, TLS, egress firewall, encryption-key rotation/re-encryption, external audit retention, backup secrets handling, deployment/load/cross-browser/accessibility and dependency remediation remain readiness work. Root/admin database privileges can bypass triggers. The frontend build still warns about a bundle above500KB. Docker/remote Actions were not executed.
7. Profile API supports structured addresses; the UI edits primary business/contact fields. No managed merchant document/KYC upload, real payment dashboard, fund custody, settlement or payout capability is advertised as operational.

## Files created or modified

**New implementation:** `gateway-api/src/management.ts`, `security.ts`, `webhookDelivery.ts`, `worker.ts`, `workerMain.ts`.

**Updated implementation/configuration:** `gateway-api/src/index.ts`, `client/src/GatewayPages.tsx`, `database/prisma/schema.prisma`, `gateway-api/package.json`, `gateway-api/package-lock.json`, `gateway-api/.env.example`, `.github/workflows/ci.yml`, `.gitignore` (allow only reviewed Phase E evidence logs).

**Migration:** `database/prisma/migrations/20261113_phase_e_merchant_management/migration.sql`.

**Tests/tools:** new `gateway-api/test/management.postgres.test.ts`, `queue.postgres.test.ts`, `webhook-security.test.ts`, `server/src/gateway.browser.test.ts`, `scripts/verify-phase-e-postgres.mjs`, `gateway-api/vitest.config.ts`; updated `gateway-api/test/auth.test.ts` for paginated-list mock persistence. Existing acceptance assertions remain intact.

**Documentation/evidence:** this report; new `docs/gateway/API.md`, `ONBOARDING.md`, `API_KEYS.md`, `WEBHOOKS.md`; updated `IMPLEMENTATION_AUDIT.md`, `REMAINING_WORK_AUDIT.md`, `SECURITY_REVIEW.md`, `README.md`; logs/JSON/PNG under `docs/evidence/phase-e/`. Existing Phase C/D screenshots are refreshed by their unchanged regression suites.

Next recommended work is review of this delivery and dependency/deployment blockers. **Stop after Phase E. Await explicit approval before Phase F or payment-provider integration.**
