# Phase D - subscriptions and financial calculations

Delivered 2026-11-13, development environment only. **Phase D implementation and the checks below are complete; the application is not production-ready. Phase E has not begun.** No production database, live payment credentials, UPI, seller payout or settlement was used.

## Completed implementation

- One versioned subscription catalog supplies public pricing, buyer/seller status, admin editing, upload permission, featured eligibility and premium financial export. Initial Free/Pro/Ultra defaults are 5 lifetime / 15 per billing term / unlimited, at 30% / 20% / 10% commission and INR0 / INR199 / INR499. The original plan takes precedence over the previous 25/100 listing defaults. [Subscription specification](SUBSCRIPTIONS.md).
- Paid contracts require a matching verified, accounted payment and immutable hash-covered purchased terms. Old plan labels, active booleans, plan selection and unpaid checkout cannot activate benefits. Expiry, cancelled benefits through expiry, immediate suspension, history, renewal eligibility and queued next-term plan changes are implemented. UTC calendar-month term boundaries clamp month ends; no proration or automatic collection is invented.
- Atomic backend quotas count all material creations. Concurrent last-slot tests pass; deletion cannot restore quota. Pro resets per verified paid term, Ultra remains unlimited, expired users fall back to Free. Existing records initialize usage without deleting or rewriting data.
- A single exact integer-paise engine calculates item totals, scoped promotions, approved tax modes, plan commission, gateway fees, seller earnings and final amount. Tax and fee policies start UNRESOLVED. UI quotes show the reason checkout is blocked instead of assuming GST is zero. SUPER_ADMIN policy changes require explicit approval references, expected versions and audit reasons.
- Immutable snapshots retain every item and seller. Atomic signed sandbox event processing posts one complete ledger per seller, safely handles retries, rejects inconsistent evidence and rolls back conflicts. All item totals reconcile. No frontend or administrator PAID override remains.
- Internal confirmed-refund accounting creates bounded, append-only, idempotent adjustments, including cumulative rounding and concurrent refund protection. It has no public confirmation endpoint and performs no provider call. Existing admin review is request/approve/reject only, audited; neither approval nor a client assertion completes a refund.
- Seller identity-scoped and admin reports use reconciled database records and independent daily/monthly/yearly IST boundaries. Reports separate gross, discounts, tax, commission, fees, seller net, refunds and subscription receipts/status. Refunds of old orders affect their own adjustment period. Legacy unaccounted records are visibly excluded; corrupted new ledgers block reporting.
- Shared subscription/financial pages replace disconnected plan cards and editable payment statuses. Existing authentication, browsing, upload/moderation, cart, protected purchase access and responsive marketplace journeys pass regression tests.

## Executed verification

| Check | Actual result |
|---|---|
| Marketplace backend ordinary suite | **102 passed**, 15 guarded browser cases skipped in this invocation; 7 executed test files |
| Gateway ordinary suite | **13 passed**, 4 PostgreSQL cases skipped in this invocation |
| Fresh isolated PostgreSQL runner | **9 passed**: gateway authentication 4, marketplace schema 5; existing migration SQL applied to a new disposable PostgreSQL16.15 cluster, stopped afterward |
| Authentication browser suite | **2 passed**, real Chrome/API/MongoDB |
| Marketplace browser suite | **9 passed**, real Chrome/API/MongoDB replica set |
| Subscription/financial browser suite | **4 passed**, real Chrome/API/MongoDB replica set |
| Marketplace backend build | Passed, TypeScript |
| Frontend build | Passed, TypeScript/Vite; main bundle exceeds the default 500KB warning threshold |
| Gateway backend build | Passed, TypeScript |
| Whitespace validation | `git diff --check` passed |

**139 distinct tests passed.** Guarded skips are not counted as passes; those cases were separately executed above. The ordinary backend count includes 26 new real MongoDB subscription/financial integration cases and 18 exact-calculation cases, plus existing regression coverage. MongoDB tests use isolated temporary databases; transaction tests use a real single-node replica set, not mocked writes. Gateway ordinary auth tests include mocked persistence; the four separate PostgreSQL auth cases use a real database. No remote GitHub Actions, production environment, Docker deployment, load test or live provider test was run.

Coverage includes all plan defaults, manual/unverified activation denial, expiry/cancellation/suspension, chained renewal terms, concurrent Free quota, Pro15, Ultra over100, catalog-version preservation, premium permissions, price/rounding/discounts, explicit inclusive/exclusive tax fixtures, all-item/multi-seller allocation, signed replay/conflicting evidence, transaction rollback, bounded partial/full/concurrent refund accounting, duplicate prevention, partial-refund download isolation, seller isolation, independently bounded reports, prior-year refund timing, missing/corrupt ledger detection, and reconciliation. The auth regression covers the existing verification/reset/rotation/revocation and role/status/security suite.

Logs: [backend](docs/evidence/phase-d/server-tests.log), [gateway](docs/evidence/phase-d/gateway-tests.log), [PostgreSQL](docs/evidence/phase-d/postgres-tests.log), [auth browser](docs/evidence/phase-d/auth-browser.log), [marketplace browser](docs/evidence/phase-d/marketplace-browser.log), [financial browser](docs/evidence/phase-d/financial-browser.log). Build logs are in the same evidence directory.

### Browser and reconciliation evidence

- [Canonical Free plan](docs/evidence/phase-d/subscription-free.png).
- [Cancelled contract retains benefits through expiry](docs/evidence/phase-d/subscription-cancelled.png).
- [Seller-scoped earnings](docs/evidence/phase-d/seller-financial-report.png).
- [Read-only order reconciliation](docs/evidence/phase-d/order-reconciliation.png).
- [Admin financial report](docs/evidence/phase-d/admin-financial-report.png).
- [Exact reconciliation JSON](docs/evidence/phase-d/reconciliation.json): test-only customer24000 = seller17800 + platform5959 + fees241 + tax0 paise. Test policy NONE is a fixture, not an approved GST decision.

All screenshots use synthetic development fixtures. The browser activation test sends signed sandbox fixture evidence; it does not demonstrate receipt of real funds. Existing Phase C screenshots are also refreshed by its regression suite.

### Reproduce on Windows

Use installed Node22/npm (this workspace used portable Node22.14.0). Use `npm.cmd` in PowerShell where npm.ps1 execution is disabled. Dependencies are already installed here; on a clean checkout run the project dependency installation first.

```powershell
npm.cmd --prefix server test
npm.cmd --prefix gateway-api test
npm.cmd --prefix server run build
npm.cmd --prefix client run build
npm.cmd --prefix gateway-api run build
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:RUN_AUTH_BROWSER='1'
npm.cmd --prefix server run test:auth-browser
Remove-Item Env:RUN_AUTH_BROWSER
$env:RUN_MARKETPLACE_BROWSER='1'
npm.cmd --prefix server run test:marketplace-browser
Remove-Item Env:RUN_MARKETPLACE_BROWSER
$env:RUN_FINANCIAL_BROWSER='1'
npm.cmd --prefix server run test:financial-browser
Remove-Item Env:RUN_FINANCIAL_BROWSER
npm.cmd install --prefix "$env:TEMP\noteora-phase-c-pg" embedded-postgres@16.15.0-beta.19
node scripts/verify-phase-d-postgres.mjs
server\node_modules\.bin\tsx.cmd server/scripts/generate-financial-evidence.ts
git diff --check
```

The PostgreSQL runner always creates a fresh cluster with a generated temporary password, never accepts an existing database URL, and stops it in `finally`. Direct schema tests now require explicit loopback `_test` database URLs. CI service database names and test URLs were aligned with that guard; this is not a remote CI pass claim.

## Database changes and development topology

**No SQL migration was added. No production migration, backfill, cutover, deletion or dual writable source was performed.** PostgreSQL remains the separate gateway/development migration target. Existing three SQL migrations were verified against the disposable database.

Additive MongoDB models: `PlanPolicy`, `FinancialPolicy`, `UploadQuota`, `FinancialAdjustment`. Additive fields on Order, SellerLedger, Subscription, Refund and PaymentWebhookEvent retain minor amounts, immutable snapshots/hashes, contract dates/status/evidence and adjustment references. Unique catalog versions, user/quota-period, subscription/payment-order and order/reference/line keys provide concurrency safeguards; seller/order uniqueness is retained. Date/seller indexes support reporting. Tests initialize these indexes in temporary databases. Any future deployment needs reviewed index provisioning and a backup/rollback plan; no production index operation was performed here.

Atomic quotas and financial writes require MongoDB replica-set transactions. This preserves the existing database and stack while changing the development topology necessary to avoid partial accounting writes. Standalone MongoDB receives a clear503 for transactional mutations; no unsafe fallback is provided. Docker is unavailable here, so the optional compose setup below was prepared but **not executed**. Real replica-set behavior was verified using mongodb-memory-server.

For a separate new disposable development database only:

```powershell
docker compose -f docker-compose.phase-d.yml up -d
docker compose -f docker-compose.phase-d.yml exec mongo-phase-d mongosh --quiet --eval 'rs.initiate({_id:"noteora-phase-d",members:[{_id:0,host:"localhost:27017"}]})'
```

Set the development marketplace `MONGO_URI` to `mongodb://127.0.0.1:27018/noteora_phase_d_development?replicaSet=noteora-phase-d&directConnection=true`. The compose file uses a separate named volume and loopback port. Do not connect it to production or reuse an existing database volume. Atlas/production topology and index rollout require separate deployment review.

## Files created or modified for Phase D

The workspace already contained approved, uncommitted Phase C work. The following lists Phase D-touched paths; cumulative Git diffs also include that existing work and its report/evidence.

**New backend implementation:** `server/src/financialRoutes.ts`; `server/src/services/money.ts`, `transaction.ts`, `reportingPeriods.ts`, `subscriptionService.ts`, `accountingService.ts`, `financialReports.ts`.

**Updated backend implementation:** `server/src/services/financialService.ts`; `server/src/models.ts`, `routes.ts`, `authRoutes.ts`, `marketplaceRoutes.ts`, `sellerRoutes.ts`, `index.ts`.

**Frontend:** new `client/src/FinancePages.tsx`, `client/src/money.ts`; updated `client/src/App.tsx`, `MarketplacePages.tsx`, `SellerPages.tsx`.

**Tests/tools/config:** new `server/src/subscription-financial.integration.test.ts`, `server/src/financial.browser.test.ts`, `server/vitest.config.ts`, `server/scripts/generate-financial-evidence.ts`, `scripts/verify-phase-d-postgres.mjs`, `docker-compose.phase-d.yml`; updated `server/src/services/financialService.test.ts`, `server/src/marketplace.browser.test.ts`, `server/src/postgres.integration.test.ts`, `server/package.json`, `.github/workflows/ci.yml`. Phase C integration assertions remain preserved in `server/src/marketplace.integration.test.ts`; their pre-existing changes are not presented as new Phase D code.

**Documentation/evidence:** this report, `FINANCIAL_CALCULATIONS.md`, `SUBSCRIPTIONS.md`, updated `README.md`, `IMPLEMENTATION_AUDIT.md`, `REMAINING_WORK_AUDIT.md`, `SECURITY_REVIEW.md`; all JSON, PNG and log files under `docs/evidence/phase-d/`, and refreshed screenshots under `docs/evidence/phase-c/`. No dependency or lockfile version was changed.

## Incomplete requirements, blockers and known risks

1. **Live paid subscriptions and automatic renewal collection:** no approved provider arrangement or integration. Order preparation remains unpaid; signed sandbox acceptance is development only and rejects production. Do not enable live processing from these fixtures.
2. **Tax and fee approval:** CA/legal and business/provider decisions remain required. Generic supported tax arithmetic does not establish Indian tax compliance, invoice validity, withholding or settlement compliance. Defaults intentionally block final checkout.
3. **Refund/payout execution:** accounting seams are tested, but customer refund requests, authoritative provider verification, operational reconciliation and seller settlement business workflows remain Phase G. No real refund/payout was initiated. Admin approval does not mean funds moved.
4. **Historical data:** pre-version2 orders/ledgers and unverified subscription records remain untouched, flagged and excluded from certified net reporting. Earlier deleted uploads cannot be reconstructed. A separate reviewed remediation is needed; no fictitious backfill was performed. Historical purchase access remains supported without retroactively certifying payment evidence.
5. **Commercial rules:** no proration, trial or automatic debit model; plan changes queue next term. Cancellation of an active contract does not automatically cancel/refund separately purchased scheduled terms. Those cases require explicit business policy before a live launch.
6. **Deployment:** replica-set topology/index rollout, backups, production scale and load/retention/accessibility/cross-browser acceptance remain unverified. The large frontend bundle warning remains. Docker compose and remote Actions were not executed.
7. **Earlier dependencies:** real SMTP delivery remains unverified without credentials. Phase C dependency advisories remain open (server2 critical/4 high/1 moderate; gateway2 critical/3 high/1 moderate; client0 in that prior scan). No fresh advisory scan or dependency upgrade is claimed in D.

Existing application functionality remains intact **within the executed regression coverage**, not as a blanket certification of every incomplete feature. The next approved major phase is gateway merchant management (Phase E); no Phase E implementation or payment-provider integration was started. Await approval before proceeding.
