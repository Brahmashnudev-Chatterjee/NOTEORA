# Phase C — Marketplace and Seller Workspace Completion

Date: 2026-11-13 (Asia/Calcutta). Scope: Phase B verification follow-up and Phase C only. **Delivered for review; the marketplace is not production ready. Phase D has not started.**

## Starting point and scope

The checkout was clean at commit `1493d3e` and already contained substantial Phase C work in `marketplaceRoutes.ts`, `sellerRoutes.ts`, `MarketplacePages.tsx`, `SellerPages.tsx`, navigation and integration/browser fixtures. These files were inspected and their behavior verified before extending them. This delivery completes and hardens that existing implementation; it is not a rebuild or a claim that all of these modules were created in this turn.

MongoDB remains the marketplace source of truth. PostgreSQL was used only for a new, disposable, loopback-bound authentication verification cluster. No existing or production database was migrated or seeded. Payment/order processing, financial calculations and subscription enforcement were left unchanged. The checkout return page was changed only to display existing purchase records rather than infer payment from a success URL.

## Phase B verification follow-up

| Item | Actual result |
|---|---|
| Fresh disposable PostgreSQL | Started PostgreSQL **16.15**, bound to loopback, with a random temporary password and new `noteora_gateway_test` database. |
| Migration application | Phase 5B, Phase 5C and `20261112_phase_b_gateway_auth` SQL all applied successfully to the fresh database. All three new MerchantUser auth columns were checked. |
| Gateway persistent authentication tests | **4/4 passed**: registration/auth-version initialization; login/refresh persistence; replay revocation; suspended merchant rejection/security audit. |
| Database cleanup | Temporary server stopped in the runner's finally block. Disposable files retained under the system temporary directory for inspection. No supplied database URL or existing cluster was used. |
| SMTP availability | SMTP_HOST, SMTP_FROM, SMTP_USER and SMTP_PASSWORD were absent; no configured local `.env` credentials were found. Actual mail delivery was therefore not attempted. Development mail and mocked TLS SMTP checks continue to pass. |
| Authentication regression | **35 existing marketplace/unit tests**, **13 gateway tests** and **2 real authentication browser journeys** passed during this phase's checks. Marketplace test totals below include those 35 cases. |

This verifies raw migration SQL and persistent gateway auth behavior in a fresh development database. It does not establish production migration, repeated Prisma migrate-deploy, managed backups, TLS/cookie deployment or external email-delivery readiness.

For actual email delivery, configure EMAIL_TRANSPORT=smtp, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_FROM and any required SMTP_USER/SMTP_PASSWORD through a secret-safe environment mechanism. Configure the sending domain's SPF/DKIM/DMARC and verify inbox delivery with the mail operator. No email was sent to a real recipient during this work.

## Completed and tested Phase C behavior

### Buyer marketplace

- Backend search matches escaped title/description/tag/course/instructor text. Subject, category, academic level, course, instructor and minimum/maximum price filters combine in actual MongoDB queries.
- Deterministic sorting supports newest/oldest, price, verified-review rating and purchases counted from PAID order records. Bounded pagination includes total/page counts.
- URL-driven filters preserve a submitted search term during rapid changes. Clear filters, pagination and browser navigation update the actual query; the search input follows submitted URL state.
- Note cards display stored thumbnails, seller name, price and calculated rating/review counts. Detail pages show descriptions, tags, course/instructor, seller biography/university, seller-wide review averages, published-note counts and related notes.
- Public previews use a separately uploaded seller-permitted PDF excerpt. The complete paid PDF is never used as the public preview fallback. Only approved material previews/thumbnails are public.
- Cart additions preserve existing items and prevent duplicate concurrent additions; removal persists to MongoDB. Invalid/unavailable items block checkout. The existing checkout request remains intact; external payment execution remains a later-phase dependency.
- Purchase history is scoped to the signed-in buyer. Existing PAID purchase records expose protected download and review actions; unpaid/wrong-owner requests are rejected.
- Download tokens bind buyer/order/material/expiry and validate malformed, expired and multibyte signatures safely. Authorized buyers retain file access after a seller archives a purchased note.
- Review creation requires a PAID order containing the note, validates integer ratings and comment length, and prevents duplicate concurrent reviews. Reviews appear on buyer, seller and public detail pages.
- Checkout return pages read the buyer's existing order list. A `/payment/success` URL cannot change an order or display an unpaid order as paid. This is presentation-only: no provider verification or payment state mutation was added.

### Seller workspace

- Dashboard and analytics use real MongoDB order/material/ledger queries. Popular materials are counted from paid order lines rather than stale Material.sales fields.
- Daily, monthly and annual summaries have independent calendar boundaries in Asia/Kolkata. Monthly series include the year and fill missing months with zero observations, rather than fabricated chart values.
- PDF upload includes description, subject, category, academic level, course, instructor, tags, price, optional thumbnail and optional public excerpt. Existing upload limits remain unchanged pending Phase D.
- Validation checks file size, declared MIME and PDF/image signatures; rejected uploads are cleaned up. Public responses omit private filesystem paths.
- Draft, pending, approved, rejected and archived states have explicit backend transitions. Sellers cannot approve their own content. Approved notes must be archived/moved to draft before seller edits and resubmitted before publication.
- My Materials has state/search filters, pagination, private PDF viewing, metadata editing, category clearing, submission/archive and permitted deletion. State changes use conditional database updates to detect conflicts.
- My Sales shows only the seller's paid order lines. Earnings displays existing ledger records with an explicit warning that recorded figures do not confirm bank settlement.
- Reviews, promotion-record create/edit/enable/disable/delete, profile editing, persisted notification preferences and support submission/history work against authenticated owner-scoped APIs.
- Subscription and Earnings pages remain usable while clearly disclosing unavailable paid activation/payout execution. No paid plan was activated and no financial/subscription implementation was started.
- Files referenced by any existing order, including pending orders, cannot be deleted. This preserves the source for potential later payment confirmation; archiving is the supported removal from public sale.

### Administration and interface behavior

- Material moderation uses backend state/search filters and pagination, so older pending notes do not disappear behind a capped, unfiltered recent-record list. The prior array response remains available for callers that omit pagination.
- Authenticated moderators can inspect the full source, unpublished preview and thumbnail; buyers cannot use that endpoint. Asset selection is restricted to a fixed allowlist.
- Admin/moderator metadata edits are validated and audited. Editing a published note returns it to PENDING rather than silently publishing changed content. Review approval/rejection remains a separate action; rejection requires feedback.
- Approved materials must be archived before deletion, and any order-referenced material is retained. Seller verification checks actual material ownership and remains separate from email verification/role assignment.
- Responsive buyer navigation and seller navigation were exercised at desktop and 390px mobile width, including a no-horizontal-overflow assertion. Labels, empty/loading/error/success states and Retry behavior were checked in the browser.
- Requests clear stale result data when a new query starts, so a failed search does not display previous results as current. Categories now distinguish loading/failure from an empty catalog. The marketing example no longer presents an invented rating/price as a note listing.

## Actual tests and builds

| Check | Result |
|---|---|
| `npm --prefix server test` | **63 passed**: 35 existing auth/unit cases plus 28 real MongoDB marketplace cases. Browser cases are excluded by environment guards in this ordinary run and executed explicitly below. |
| `npm --prefix gateway-api test` | **13 passed**. Four guarded PostgreSQL cases skip in this ordinary command; all four were executed successfully by the isolated runner. |
| `node scripts/verify-phase-b-postgres.mjs` | Fresh SQL migrations and **4 PostgreSQL gateway tests passed**; temporary cluster stopped. |
| Authentication browser suite | **2 passed**, real Chrome, real API, ephemeral MongoDB: register/verify/logout and recover/reset/login/session restore. |
| Marketplace browser suite | **9 passed**, real Chrome, real API, ephemeral MongoDB: upload/edit/submit; moderation/private asset review/admin edit/seller verification; browse/filter/sort/paginate/cart; download/review/analytics; promotions/profile/preferences/support; archived access/mobile navigation; error/empty/Retry; unconfirmed return URL; remaining seller pages. |
| Marketplace API TypeScript build | Passed. |
| React TypeScript/Vite production build | Passed. Existing large-chunk warning remains (approximately 572 kB before gzip). |
| Gateway TypeScript build | Passed. |
| `git diff --check` | Passed. |
| Remote GitHub Actions / production deployment | Not executed. |

**91 distinct executed test cases passed** across the listed suites. The final ordinary server run skips 11 guarded browser cases, and the ordinary gateway run skips four guarded PostgreSQL cases; these are not counted as passes in those commands. Their explicit executions are reported separately above, without double-counting reruns.

Additional integration cases cover combined database filters, private response serialization, MIME/signature failures and cleanup, category clearing, moderation paging, owner/role denial, permitted transitions, concurrent cart/review writes, archived/PENDING-order file retention, expired/tampered downloads, separate IST period boundaries and promotion ownership. Tests never connect to production.

PAID purchases in the marketplace tests are explicitly created **only in disposable databases** to exercise existing entitlements and reports. They do not demonstrate provider payment confirmation, successful bank settlement or a completed payment integration. The error-state test deliberately intercepts one browser request with a test-only 503; the remaining marketplace journey uses the actual API/database.

Intermediate checks caught an incorrect test URL, an ambiguous browser selector, text encoding and loss of a search term during quick filter changes. These were corrected and the affected suites rerun successfully. A concurrent API/browser stress run also hit the existing five-second password-reset test timeout; the unchanged API suite was then rerun alone. No failing assertion or timeout remains in the final recorded runs.

## Browser evidence

These screenshots are generated by the tests from isolated, synthetic fixtures; they are not production sales or real customer records.

- [Buyer marketplace and filters](docs/evidence/phase-c/buyer-marketplace.png)
- [Admin material moderation](docs/evidence/phase-c/admin-moderation.png)
- [Seller materials](docs/evidence/phase-c/seller-materials.png)
- [Database-derived seller analytics](docs/evidence/phase-c/seller-analytics.png)
- [Buyer mobile navigation](docs/evidence/phase-c/buyer-mobile.png)
- [Seller mobile navigation](docs/evidence/phase-c/seller-mobile.png)
- [Recovery from a transport error](docs/evidence/phase-c/buyer-retry-recovered.png)
- [Unconfirmed payment-return page](docs/evidence/phase-c/payment-return-unconfirmed.png)

Buyer and seller analytics screenshots were visually inspected as well as checked through browser assertions. This does not replace comprehensive accessibility, cross-browser or production load testing.

## Dependency advisory review

`npm audit --json` and `npm audit --omit=dev --json` were executed on 2026-11-13. Counts below are affected package nodes reported by npm, not distinct independently exploitable vulnerabilities; related/transitive entries overlap.

| Package set | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| Marketplace server, all dependencies | 2 | 4 | 1 | 0 | 7 |
| Gateway, all dependencies | 2 | 3 | 1 | 0 | 6 |
| Client | 0 | 0 | 0 | 0 | 0 |
| Server with `--omit=dev` | 0 | 4 | 0 | 0 | 4 |
| Gateway with `--omit=dev` | 0 | 3 | 0 | 0 | 3 |

| Severity | Affected package nodes | Classification / next action |
|---|---|---|
| Critical | tinypool, vitest in server and gateway | Worker-option prototype-pollution/RCE advisories and propagated test-tool dependency severity. They disappear from the omit-dev audit. Upgrade the test toolchain with compatibility tests; never expose test runner/UI servers to untrusted clients. |
| High | prisma, @prisma/config, deepmerge-ts in both; effect additionally in server | Transitive merge stack exhaustion and Effect RPC/context advisories propagate through Prisma configuration. These **remain in the omit-dev graph**, so they cannot all be dismissed as development-only. Review the installed Prisma dependency chain and a supported upgrade/remediation separately; no major Prisma migration was attempted in Phase C. |
| Moderate | @vitest/mocker in both | Mock-registration/path traversal/code-injection advisories, in the test-tool dependency graph. Address with the compatible test-tool upgrade. |

Advisory examples returned by npm: [Tinypool worker options](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [Tinypool run options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr), [Vitest mock registration](https://github.com/advisories/GHSA-qxg6-89mg-rqv8), [DeepmergeTS](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [Effect](https://github.com/advisories/GHSA-38f7-945m-qr2g).

No dependency versions or lockfiles were changed in this phase. Successful tests do not resolve these advisories or establish absence of an exploitable application path.

## Reproduction

From the repository root with Node/npm available (the session used temporary Node v22.14.0):

```powershell
$env:PATH = (Join-Path $env:TEMP 'noteora-phase-b-tools\node-v22.14.0-win-x64') + ';' + $env:PATH
npm ci --prefix server
npm ci --prefix client
npm ci --prefix gateway-api
npm --prefix server test
npm --prefix gateway-api test
npm --prefix server run build
npm --prefix client run build
npm --prefix gateway-api run build

$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:RUN_AUTH_BROWSER = '1'
npm --prefix server run test:auth-browser
Remove-Item Env:RUN_AUTH_BROWSER
$env:RUN_MARKETPLACE_BROWSER = '1'
npm --prefix server run test:marketplace-browser
Remove-Item Env:RUN_MARKETPLACE_BROWSER
```

If Chrome is not installed, install Playwright Chromium and omit CHROME_PATH. Both browser suites start the real API, Vite and isolated MongoDB, then shut them down. No existing account/database credentials are needed.

The PostgreSQL runner already present in this checkout can be reproduced without Docker or a supplied database URL:

```powershell
$pgTools = Join-Path $env:TEMP 'noteora-phase-c-pg'
npm install --prefix $pgTools embedded-postgres@16.15.0-beta.19
$env:NOTEORA_PG_TOOLS = $pgTools
node scripts/verify-phase-b-postgres.mjs
```

The runner creates a temporary cluster and test-only credentials, applies all three SQL files, runs the four persistent auth tests and stops the cluster. It never accepts an existing database URL. Repeated Prisma migrate-deploy/rollback validation remains a separate Phase E acceptance item.

## Files changed in this delivery

- `server/src/marketplaceRoutes.ts` — private review assets, seller-wide ratings, validated admin edits, paginated moderation, retention/deletion checks, bounded cart additions, optional category clearing and safe download signatures.
- `server/src/sellerRoutes.ts` — bounded seller pagination, per-note paid-order sales counts and verification of actual sellers.
- `client/src/MarketplacePages.tsx` — query/error-state behavior, coherent search/filter updates, private asset controls, seller summaries and moderation editing/paging.
- `client/src/SellerPages.tsx` — editable category clearing and per-note views/paid sales.
- `client/src/App.tsx` — real category states, honest read-only purchase status and marketing example cleanup.
- `server/src/marketplace.integration.test.ts` — expanded from 21 to 28 real database cases.
- `server/src/marketplace.browser.test.ts` — expanded from six to nine real browser cases, including additional moderation/asset/search assertions.
- `docs/evidence/phase-c/*.png` — regenerated/added browser evidence (including retry recovery and unconfirmed payment return).
- `PHASE_C_MARKETPLACE_REPORT.md` — created.
- `REMAINING_WORK_AUDIT.md`, `IMPLEMENTATION_AUDIT.md`, `SECURITY_REVIEW.md` — current evidence and remaining risks updated.

The existing PostgreSQL runner, schemas, migration SQL, package/lockfiles, payment/order route file and payment/financial services were inspected or executed but not modified. Automated source comparisons confirmed the payment/order routes file and financial/payment services remain unchanged from the starting commit.

## Partial capabilities, remaining blockers and boundaries

- **Payments:** provider checkout/verification, reconciliation and signed event/ledger correctness remain later-phase work. Existing manual admin payment/refund status overrides are a known unresolved risk. Read-only status presentation and entitlement tests do not certify the origin of legacy PAID records.
- **Subscriptions/finance:** plan discrepancy, expiry/renewals, verified paid activation, central decimal-safe arithmetic, tax approval and advertised commission alignment remain Phase D/F. Existing quota logic and financial calculations were not changed. Gross analytics report stored paid order lines; recorded net earnings remain dependent on the incomplete legacy ledger.
- **Payouts/refunds:** no provider execution or seller settlement request lifecycle was introduced (Phase G). Ledger history is explicitly not bank settlement evidence.
- **Promotions:** owner-scoped record management works; discounts are not applied at checkout. This limitation is shown in the UI and awaits the financial phase.
- **Files:** private local disk, type/size signatures, excerpts and signed authorization work. Managed object storage, full PDF parsing, malware/quarantine integration, lifecycle/retention, immutable paid-file versioning and content/plagiarism review remain Phase H/production work. File deletion and MongoDB updates are not one distributed transaction.
- **Profiles/verification/support:** profile text/contact/preferences and support creation/history work. Avatars/verification documents, KYC review, support replies and a complete admin support console remain later scope. Seller verification is an admin record, not regulatory certification.
- **Notifications:** moderation creates preference-aware in-app records. Real-time delivery, email notification production/read-state management and real SMTP delivery remain incomplete. No unavailable notification control is represented as functioning.
- **Scale/operations:** some legacy lists still cap records rather than expose pagination; the reviewed moderation/browse/seller-material queues paginate. Aggregation performance at production scale, complete browser/device/accessibility testing, monitoring, shared rate limits, backup/restore and remote CI evidence remain outstanding.
- **Schema parity:** MongoDB has the expanded material states/profile fields; no PostgreSQL marketplace cutover or production schema migration was performed. Reconcile migration-target parity separately before any future cutover approval.

Existing authentication and tested buyer/seller/admin journeys remain functional. The delivery is ready for Phase C review with these explicit boundaries, not a production launch. **Stop here and wait for approval before Phase D.**
