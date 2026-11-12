# Noteora remaining work audit — Phase A

Audit date: 2026-11-12 (Asia/Calcutta). Decision: **incomplete; not production ready**.

This document retains the Phase A baseline and is updated with Phase B evidence below. Phase A was approved; Phase B authentication implementation and isolated tests are now delivered. No production data, database deployment or live payment configuration was changed. Phase C requires approval.

## Evidence and scope

Reviewed the five-page `Project Plan_ Student Notes Marketplace.pdf`, README (including consolidated historical reports), marketplace routes/auth/models/services/workers, all React source modules and styles, gateway source/frontend, Prisma schema and migration definitions, existing test sources, package scripts, Docker definitions and `.github/workflows/ci.yml`.

The requested standalone `IMPLEMENTATION_AUDIT.md`, `PHASE3_REPORT.md`, `PHASE5A_REPORT.md`, `PHASE5B_REPORT.md`, `PHASE5B_1_REPORT.md` and `PHASE5C_REPORT.md` were absent at audit start. Their text is available under identically named “Consolidated source” sections in README. These were reviewed as historical reports, not fresh verification. A current standalone implementation audit accompanies this document.

Document statements are evidence and requirements context, not instructions to execute historical migration/seed/payment commands. The user's current phase boundaries control this work. Competitor examples, Django recommendations and the PDF's tax illustrations are not implementation or legal authority. Existing React/Express/MongoDB architecture remains in place.

### Classification

- **C — COMPLETE AND TESTED:** the full requirement has relevant executed acceptance evidence for the current revision.
- **U — IMPLEMENTED BUT NOT TESTED:** implementation appears present; current execution evidence is missing.
- **P — PARTIALLY IMPLEMENTED:** missing behavior, incorrect semantics or disconnected UI/API.
- **N — NOT IMPLEMENTED:** no functional implementation found; schema alone does not qualify.
- **X — BLOCKED BY EXTERNAL DEPENDENCY:** external credentials, arrangements or professional decisions are necessary for the named external capability.

No full product requirement is classified C in this review: builds, browser journeys and database suites could not run here. Existing tests are recorded separately; this does not erase historical results. Software interfaces and sandbox work remain actionable even when production integrations are X. Requirements below split compound plan statements into individually assessable capabilities; added requirements from the current request are identified by their phase.

## Original plan coverage: accounts and buyer journeys

| ID | Requirement (PDF pages) | Status | Current evidence / remaining work | Phase |
|---|---|---|---|---|
| A01 | Signup and login (1,4) | C | Existing forms/API plus normalized login, duplicate/invalid input tests and real browser registration/login passed in Phase B. | B |
| A02 | Buyer/seller/both identity and educator/student profile (1) | P | Shared USER account can upload/buy; no educator/student profile fields. Guest browsing exists; guest checkout is absent. | B,C |
| A03 | Name, contact details, profile editing (1,4) | P | `/users/me` updates name only; buyer profile is read-only; contact/bio/avatar/payment settings absent. | C,H |
| A04 | Email verification or OTP/social alternative (4) | C | Secure single-use expiring email-token flow and browser verification passed. Actual SMTP delivery is separately blocked under R03; social login remains an optional alternative. | B |
| A05 | CAPTCHA / signup bot prevention (4) | N | Generic API rate limit exists; no CAPTCHA integration. | B,I |
| A06 | Personalized dashboard (4) | P | Seller summary exists; buyer dashboard journey and comprehensive error states incomplete. | C |
| A07 | Browse approved notes (1,5) | U | Database query limits public listings to APPROVED. | C |
| A08 | Search title/description/tags (1,5) | P | Backend regex search exists; uncontrolled regex input, no pagination/query limits; error becomes empty result. | C |
| A09 | Subject/course/category filters (1,5) | P | Subject API filter exists; category links use text search rather than category identity; course/instructor model absent. | C |
| A10 | Academic-level, price and instructor filters (1) | N | No backend filter handling for these fields; academic level stored only. | C |
| A11 | Sorting popularity/date; grid/list (5) | P | Fixed newest-first sort; no selectable popularity/date or list/grid controls. | C |
| A12 | Note cards: title, author, thumbnail, price, rating (1,5) | P | Title/author/price present; icon replaces uploaded thumbnail; rating hardcoded 0.0. | C,H |
| A13 | Full description, seller bio and average rating (1,5) | P | Detail component displays title/description/price; populated seller is not rendered as a full seller panel. | C |
| A14 | Permitted PDF preview (1,5) | N | No bounded/redacted public preview or authenticated moderator preview journey. | C,H |
| A15 | Detail reviews/FAQ tabs and related notes (5) | N | No functional detail tabs, review list or related notes. | C |
| A16 | Cart add/manage items (1,5) | P | Backend replaces cart; detail add overwrites existing items; UI lacks remove/update workflow. | C |
| A17 | Checkout totals including configured taxes/fees (1,3,5) | P | Server reads prices; GST fixed zero; financial helper unused by checkout. Cart lacks final breakdown. | D,F |
| A18 | Payment checkout and confirmation (1,5) | P | External client exists; cart ignores returned payment URL/intent; pending page has no polling. Success label depends on URL path. | F |
| A19 | Live payment methods (UPI/card as supported) (5) | X | Requires authorized provider agreement, credentials and supported methods; no operational provider confirmed. | F |
| A20 | Purchase transaction history (1,4) | U | Owned-order API and table exist; no current runtime evidence. | C,F |
| A21 | Paid purchase download links (1,4,5) | P | API ownership/PAID/HMAC checks exist; purchase table exposes no download action. Malformed signature length can throw. | C,H |
| A22 | Verified-purchase rating/comment form (2,5) | P | API validates purchase; no buyer review form. `/reviews` calls `/reviews/none` and returns empty data. | C |
| A23 | Review display and seller ratings (1,2,5) | P | Public review API and seller review page exist; marketplace averages/details disconnected. | C |
| A24 | Account password/payment-method settings (4) | P | Password change/recovery and revocation tested in Phase B; payment-method management remains absent. | B,C,F |
| A25 | Subscription status, change and payment history (4,5) | P | Plans visible; no paid billing/history/renewal journey. | D,F |

## Original plan coverage: seller, plans and finance

| ID | Requirement (PDF pages) | Status | Current evidence / remaining work | Phase |
|---|---|---|---|---|
| S01 | Any user becomes seller by uploading (2) | U | Authenticated USER uploads through `/materials`. | C |
| S02 | PDF upload/title/description/course tags/price (1,2,4) | P | PDF upload, academic level, tags and cover exist; validation/cleanup and course categorization incomplete. Word upload mentioned in competitor discussion is not a mandatory format; PDF is the primary planned flow. | C,H |
| S03 | Five free uploads then subscription (1,2,3,4) | P | Hardcoded count checks; free count includes all records; exhaustion shows error rather than upgrade journey. | D |
| S04 | Read uploaded notes/status/stats (2,4) | P | Status table exists; sales counters are not maintained by payment processing. | C,F |
| S05 | Edit note description/price (2) | U | Owner updates non-approved material via field allowlist; approved edits blocked. | C |
| S06 | Delete unpublished material (2) | P | Owner delete and PDF deletion exist; cover cleanup missing; archive/delete UI wording ambiguous. | C,H |
| S07 | Pending approval, publish, rejection feedback (2) | P | Moderation status/note stored; notification and PDF review workflow missing. | C,H |
| S08 | Plagiarism/spam/duplicate quality checks (1,2) | N | No scanning or duplicate detection workflow; manual moderation alone does not establish this. | H |
| S09 | Sales count and earnings per note (2) | P | Seller orders/ledger summaries exist; multi-item ledger bug and stale sales counters undermine totals. | C,D,F |
| S10 | Pending payouts and minimum-balance withdrawal (2) | P | Ledger status display only; no minimum balance/request/reservation/approval flow in MongoDB API. | G |
| S11 | Provider withdrawal/local transfer (2) | X | Provider/approved settlement arrangement required; no external transfer capability established. | G |
| S12 | Base note price <= INR 150 (1,3) | U | Model/upload/edit checks exist; boundary helper tests exist, not rerun. | D |
| S13 | Transparent commission and tax breakdown (3,4) | P | Fixed 30% webhook commission, zero GST, zero gateway cost; helper uses JS numbers and different revenue formula. | D |
| S14 | Professionally approved tax treatment (3) | X | PDF tax example is not accepted policy; CA/legal review needed for GST base, liability, invoicing and settlement treatment. | D,G,I |
| S15 | Free plan: 5 uploads, 30% fee (4) | P | Defaults present; counting semantics/expiry consistency not established. | D |
| S16 | Pro: INR 199/month, ~15 monthly uploads, ~20% fee (4) | P | Display/defaults use 25 active listings; payment activation returns 402; webhook always takes 30%. | D,F |
| S17 | Ultra: INR 499/month, unlimited uploads, ~10% fee (4) | P | ULTRA code/Ultra Pro label; defaults 100 active listings; paid activation unavailable. | D,F |
| S18 | Featured listings, premium/basic analytics (4) | P | Featured config exists but listing ranking not driven by plan; charts use hardcoded values. | C,D |
| S19 | Priority support/review, newsletters/marketing boosts (4) | N | Described as examples/possibilities; no implementation. Do not advertise guaranteed service levels without operational capacity. | C,H |
| S20 | Subscription recurring billing, trials/overdue state (2,4,5) | N | No renewal/payment linkage; expiry worker returns a status without performing expiry. | D,F |
| S21 | Platform profit/commission and gateway fee accounting (3,4) | P | Noncentralized floating calculations; no consistent accounting snapshot/refund adjustments. | D,G |

## Original plan coverage: administration and public pages

| ID | Requirement (PDF pages) | Status | Current evidence / remaining work | Phase |
|---|---|---|---|---|
| M01 | Secure admin portal and role enforcement (2,5) | P | Phase B backend revalidates current role/account/session and rejects unauthorized access. Full admin browser/management acceptance remains H/I. | B,H |
| M02 | Users/active sellers/monthly revenue/recent uploads overview (2,5) | P | Active sellers counts all active users; approved count includes rejected; pending settlements hardcoded zero. | H |
| M03 | Historical sales/user charts (2,5) | P | Decorative static chart; no real period series. | C,H |
| M04 | User CRUD, deactivate and plan override (2,5) | P | Phase B protects privileged accounts, restricts role creation and parses account booleans; broader admin CRUD/browser acceptance remains H. | B,H |
| M05 | User filters/detail/activity history (2,5) | P | Generic client-side record search and activity/session APIs; no joined per-user detail/date/role workflow. | H |
| M06 | Content approval/rejection with feedback (2,5) | P | APIs/UI exist; preview absent; UI offers PENDING but status endpoint rejects it. | C,H |
| M07 | Admin manually edit/remove any note (2,5) | P | Delete/status exist; full content edit absent. | H |
| M08 | Orders/transactions filter date/user and track sold notes (2,5) | P | Listing exists; generic text search only; no complete typed filters/detail journey. | H |
| M09 | Revenue vs commission vs payouts (2,5) | P | Ledger aggregates partial; unsafe status overrides, incorrect reporting periods. | D,G,H |
| M10 | Admin configurable plan prices/limits/fees/featured (2,5) | P | Plan CRUD exists but upload/webhook logic ignores these records; generic form types inconsistent. | D,H |
| M11 | Admin billing trials/active/overdue (2) | N | Plan CRUD is not subscriber billing management. | D,H |
| M12 | Category/subject CRUD (2,5) | P | Category CRUD exists; subject is free text; active field rendered but absent in schema. | C,H |
| M13 | Site announcements/blog/FAQ/contact configuration (2) | N | No managed configuration endpoints or UI. | H |
| M14 | Reported reviews/users and moderation actions (2) | P | Review.reported field only; no reporting/action journey. | H |
| M15 | Upload/user/approval reports and CSV export (2,5) | P | Finance CSV endpoint exists, JSON serialization is not robust CSV escaping; UI has no export/date controls or usage reports. | H |
| M16 | Landing hero/CTA and how-it-works (4) | U | Existing responsive animated sections; four steps rather than example three is acceptable. | C,I |
| M17 | Featured/new notes/categories and carousel/sliding cards (1,4) | P | Animated static subject links and example note card; no real featured/new note feeds. | C |
| M18 | Testimonials (4) | N | No verified testimonial content; do not fabricate testimonials. | H |
| M19 | Pricing section (4) | P | Exists but plan benefits/limits duplicated and inconsistent with plan/API behavior. | D |
| M20 | FAQ (4) | N | No functional FAQ content/management. | H |
| M21 | Footer contact/terms/social; terms/privacy links (4) | P | Branding/copyright footer only; consent text lacks complete policy content/navigation. | H,I |
| M22 | Cream/black/orange style, animations, rounded cards (5) | U | CSS/Tailwind/Framer Motion present; no current visual acceptance run. | C,I |
| M23 | Responsive, accessible pages/navigation (4,5) | P | Breakpoints/mobile navigation present; browser, keyboard, screen reader and overflow checks outstanding. | C,I |

## Current-request extensions and gateway readiness

| ID | Requirement | Status | Evidence / missing behavior | Phase |
|---|---|---|---|---|
| R01 | Hashed single-use expiring verification tokens | C | 24-hour hashed verification tokens atomically consumed; invalid/expired/reused/concurrent/resend/bypass and browser checks passed. | B |
| R02 | SMTP email delivery with honest development adapter | U | Development mailbox exercised by real API/browser tests; configurable TLS SMTP submission covered with mocked transport, not real delivery. | B,H |
| R03 | Actual SMTP delivery | X | SMTP credentials/domain configuration and delivery verification required. | B,H |
| R04 | Reset token expiry/single use and recovery UI | C | One-hour reset tokens, atomic consumption, replacement/invalidation, session revocation and recovery/reset browser journey passed. | B |
| R05 | Refresh rotation, revocation, security activity | C | Marketplace session listing/revoke/logout-all, access expiry, refresh rotation/reuse/concurrency and password-change revocation tests passed. | B |
| R06 | Cookie CSRF and current account/role enforcement | P | Marketplace Origin/header CSRF and current role/status enforcement passed. Gateway behavior tests pass, but PostgreSQL session persistence acceptance remains unexecuted. | B |
| R07 | Paginated, safe backend marketplace queries | N | Returns full arrays; no pagination limits, escaped search or requested filters/sort. | C |
| R08 | Draft/archive lifecycle | P | UI DRAFT tab exists; both schemas allow only PENDING/APPROVED/REJECTED. Current request explicitly adds draft/archive. | C |
| R09 | Seller dashboard/upload/materials/sales/earnings | P | All pages exist; CRUD, accounting, preview and payout gaps above prevent acceptance. | C,G |
| R10 | Seller analytics/reviews/promotions | P | Static charts; popular sales stale; promotions CRUD not applied at checkout and no material-ownership check. | C,D |
| R11 | Seller subscription/profile/settings/support | P | Name/password/ticket flows exist; preference toggle only local React state; no support replies/status management. | B,C,H |
| R12 | Central plan config; purchase/expiry/renewal/history | N | Multiple frontend/backend/seed defaults; no authoritative billing state machine. | D,F |
| R13 | Decimal-safe central finance and refund/settlement math | P | Prisma decimals exist only in nonauthoritative target; MongoDB/JS number helper is not used by orders/webhooks. | D,G |
| R14 | Authenticated gateway admin approval/rejection UI | P | Phase B removes shared-admin-token auth; adds live marketplace admin introspection and authenticated frontend fetch. Approval/rejection controls still Phase E. | E |
| R15 | Merchant registration/login/profile backend | U | Merchant login/access/refresh/logout status checks expanded in Phase B. Mocked-persistence tests pass; four actual PostgreSQL cases skipped pending isolated database. | E |
| R16 | Merchant team endpoints and UI | N | MerchantUser model/roles exist; no team lifecycle API/UI. | E |
| R17 | API-key creation/rotation/revoke/list | U | Hashing, approval checks and merchant scoping exist; DB journey untested. | E |
| R18 | API-key request authentication middleware | P | `/credentials/verify` validates body only; no reusable credential authentication for payment resources. | E |
| R19 | Cross-merchant isolation acceptance tests | N | Four gateway tests do not exercise two merchant databases/identities. | E |
| R20 | Merchant audit history and actionable developer UI | P | Phase B adds separate merchant login/logout and admin authentication; profile/key/webhook/team management cards still need Phase E actions. | E |
| R21 | Webhook configuration | U | Scoped configuration, encrypted secret, one-time response and metadata listing exist; no current DB test. | E |
| R22 | Fresh migration deployment and repeat deploy | P | Auth migration prepared and CI SQL setup extended. No actual PostgreSQL auth migration run; clean/repeat Prisma deployment remains Phase E. | E,I |
| R23 | Gateway payment orders, dynamic QR, intent/status | N | Prisma models only; gateway API implements no order/payment endpoints. | F |
| R24 | Isolated sandbox provider and authorized adapter interface | N | Marketplace client calls an external contract; no local sandbox/provider abstraction. | F |
| R25 | Production provider verification | X | Authorized arrangements, sandbox/live credentials, signing contracts and approvals unavailable/unverified. | F |
| R26 | Signed outbound delivery, durable outbox/retries | P | Schema/queue scaffolding; no producer/dispatcher/decrypt/delivery workflow. | F |
| R27 | Incoming idempotent payment/ledger processing | P | HMAC helper exists; event persistence and financial mutations are nontransactional; see blockers. | F |
| R28 | Reconciliation | P | Migration reconciliation artifacts exist; provider/payment reconciliation worker does no work. | F,G |
| R29 | Refund request/approve/reject/status/provider adjustments | P | Admin local request returns 501; arbitrary COMPLETED patch possible; buyer request and provider lifecycle missing. | G |
| R30 | Payout request/approval/reserve/status/reconciliation | N | PostgreSQL settlement model does not implement MongoDB marketplace workflow. | G |
| R31 | Authoritative payout/refund execution | X | Authorized provider or documented approved settlement evidence required. | G |
| R32 | Seller verification/admin workflows | P | Uses same verified flag as email; no separate document review/verification state. | H |
| R33 | Private PDFs and signed downloads | P | `/uploads` denied; disk downloads protected, but public detail/list returns raw material including internal paths. UI missing. | H |
| R34 | Object storage, thumbnail serving/lifecycle adapters | N | Disk uploads only, private thumbnails lack working serving workflow; no object-store abstraction. | H |
| R35 | Production object-store service | X | Bucket, credentials, encryption/retention and access policies needed. | H |
| R36 | Size/type validation and malware quarantine integration | P | 20 MB/MIME/extension/PDF header checks; no scanner adapter/quarantine or robust image validation. | H |
| R37 | Operational malware scanning | X | Scanner service/engine and policy required; missing interface remains software work. | H |
| R38 | Email/in-app notifications and history | P | Notification read API/table only; no producer events/read-state actions/delivery; preference not persisted. | H |
| R39 | Preserve MongoDB authority and separate gateway | U | Marketplace uses Mongoose; gateway Prisma; no application dual-write path found. Schema parity still needs reconciliation. | All |
| R40 | Buyer/seller/admin/gateway E2E suites | P | Two real Phase B Playwright/Chrome auth journeys pass; full buyer/seller/admin/gateway business E2E remains Phase I. | I |
| R41 | MongoDB integration coverage | P | Marketplace suite now 35 executed passes including real isolated MongoDB auth integration; broader business workflows remain untested. | B–I |
| R42 | PostgreSQL integration coverage | P | Existing five schema tests retained; four new isolated PostgreSQL gateway auth cases added but not executed. No schema-only claim of merchant acceptance. | E,I |
| R43 | CI builds/schema/database/security/browser checks | P | Existing CI retained with required auth migration/test-secret wiring; remote CI, browser/security scan expansion still Phase I. | I |
| R44 | Deployment/monitoring/secrets/backup/restore evidence | P | Compose/security/backup scripts exist; production observability/retention/recovery and current runtime evidence absent. | I |

## Critical discrepancies and failure cases

1. **Verification bypass:** `server/src/routes.ts` `/auth/verify` marks any authenticated user verified without checking a token. Registration issues access immediately. Recovery text claims email instructions despite no sender.
2. **Stale marketplace privileges:** `auth.ts` trusts JWT role/account data for 15 minutes; deactivation or demotion does not revoke existing access. Admin update protects assigning SUPER_ADMIN but not every operation against an existing privileged target. Generic admin forms also offer unsupported roles/statuses and string booleans.
3. **Unverified financial status overrides:** admin order PATCH accepts PAID; refund PATCH accepts COMPLETED without provider evidence. Downloads trust PAID, so the admin order path can grant paid entitlements without verification. Restrict to audited permitted transitions with authoritative evidence, not a generic status editor.
4. **Webhook crash/retry loss:** event is recorded with processedAt before order validation or ledger mutation. Any create error is treated as duplicate. A subsequent crash/retry may permanently skip financial work. Use transactional/recoverable inbox processing and retry states.
5. **Webhook amount/environment/state gaps:** amount validation is optional, only reads top-level amount, nonfinite amounts can evade comparisons; order environment/currency/reference binding is incomplete. Sequence zero/equal sequences and late failed/pending events can regress PAID. Event header selects transition separately from the signed body. Require authenticated event semantics and explicit monotonic state transitions.
6. **Ledger loses seller items:** unique `(seller,order)` upsert sets first item's figures only; two purchased materials from the same seller lose the later item's earnings. Ledger, cart clearing and order update are not atomic. Status polling can mark PAID without creating ledger entries. Snapshot per-line economics and aggregate consistently.
7. **Checkout is disconnected:** cart navigation discards provider payment URL/intent; success text follows location.pathname; purchases have no download button; reviews have no creation UI. A build cannot validate these journeys.
8. **Plans disagree:** PDF examples propose Pro ~15 uploads/month and unlimited Ultra. UI/API defaults use 25/100 active listings; upload code hardcodes those limits and does not reject expired subscriptions. Admin plan changes do not control enforcement. User.plan and Subscription can disagree. Paid plans return 402.
9. **Finance is not centralized:** orders set GST zero; webhook fixes 30%; helper uses floating numbers and subtracts GST in platformRevenue inconsistently. The existing subscription helper test caps 199/499 to 150 instead of testing subscription billing. It is not subscription acceptance evidence.
10. **Analytics are decorative or mislabeled:** seller chart literal array, stale Material.sales, month-name aggregation merges different years; admin daily/monthly/annual fields all sum the same date range. Active seller count includes buyers and approved count includes rejected material.
11. **Draft/archive mismatch:** UI DRAFT filter and archive/delete wording have no corresponding persistence/transition semantics. PDF primarily requires pending/live/rejected and unpublished deletion; the new request adds draft/archive explicitly.
12. **Gateway management is disconnected:** shared admin token is unsuitable for shipping into browser bundles; use authenticated administrator identities/server-mediated authorization. Merchant cards have no controls; team model has no lifecycle. Gateway total sums undefined status counts and may incorrectly return zero.
13. **Deployment claims conflict with files:** README says Compose fallback secrets were removed, but gateway-api and gateway-worker still contain known development secret fallbacks while NODE_ENV is production. gateway-worker starts the API entry point, not a delivery worker. Gateway browser origin defaults to 5174 although README advertises gateway pages at 5173.
14. **Queue completion is misleading:** expiry/reports return “processed” without mutations/report generation; email with SMTP_HOST returns a provider-required status without sending. Queue success is not business completion. Queue connection uses host/password vars whereas containers primarily provide REDIS_URL; Vite proxy also targets localhost from inside its container. Validate actual container connectivity.
15. **Storage and privacy gaps:** PDF uploads can be orphaned on validation/limit failures; delete omits cover cleanup; paths leak in public serialized materials; no scanner/quarantine/lifecycle. Download timingSafeEqual needs equal-length validation before comparison. No public unrestricted PDF access was found, but privacy contract needs response DTOs and tests.
16. **Schema/migration drift:** MongoDB adds Promotion but Prisma/export/import coverage lacks that model. Rich PostgreSQL sessions/payment/settlement records are not marketplace business implementations. No cutover or dual write is proposed.
17. **Documentation chronology:** consolidated reports alternately say phases not started, completed, rejected, and remediated. README percentages and past passing commands do not establish present readiness. `install:all` excludes gateway; root build excludes gateway; README uses `mongodb` in a Compose command but actual service is `mongo`.

## Requirements reconciliation proposed for approval

- Keep FREE/PRO/ULTRA stable internal identifiers, display the premium tier as “Ultra Pro”. Proposed plan policy: Free five total uploads, Pro 15 uploads per monthly entitlement period, Ultra unlimited uploads subject to safety/rate/file limits. Preserve existing materials and record grandfathering explicitly; never delete content to impose a new limit. The PDF also says “at a time”, so counting semantics are a product decision to lock before Phase D, not silently infer from 25/100 defaults.
- Retain proposed monthly prices INR 199/499 and illustrative commissions 30/20/10 as versioned business configuration pending approval. Backend serves authoritative plan records; frontend fetches them; order/entitlement records snapshot versions. Do not silently change existing billable contracts.
- Implement email verification rather than adding social login as a substitute. Keep token consumption atomic, hashed, purpose-bound and expiring. Choose one deliberate session transport; if refresh cookies are used, include CSRF/origin controls and secure cookie policy.
- Use integer minor units with explicit rounding/rate precision or a decimal library for active MongoDB financial paths. Do not switch authority to PostgreSQL to obtain decimals. Preserve historical values with explicit schema evolution and no automatic data rewrite.
- Keep tax configuration explicitly unapproved until CA/legal review. The PDF's 18% example is not a production default or verified tax advice; define taxable base, liability and fee bearer before activating live calculations.
- Deliver isolated deterministic sandbox behavior and provider interfaces without pretending to have production authorization. Gate live mode on explicit configuration and approved provider contracts; frontend/QR/claims never prove payment.
- Treat demographic analytics, priority response SLAs, newsletters and testimonials as plan suggestions requiring truthful data/content and operational support. Implement meaningful controls or remove unfulfilled claims; do not fabricate data.

## Proposed implementation order and phase acceptance

Each phase must update this audit and implementation audit, list changed files, run relevant checks, report actual results and unresolved dependencies, and stop for approval before the next major phase.

| Phase | Work in order | Acceptance evidence before approval |
|---|---|---|
| A (this delivery) | Inventory, requirements mapping, discrepancies, dependency and acceptance plan. | Documents checked; no runtime success claimed; no product code changes. |
| B | Email adapter; verification/reset atomic tokens; login validation; session/refresh rotation/reuse revocation; current user/role enforcement; CSRF for selected transport; security activity and UI. | Isolated MongoDB API tests for valid/expired/reused tokens, dev mailbox, reset, login, rotation/replay/logout, inactive/demoted accounts, admin target protection and CSRF. Builds. Update SECURITY_REVIEW.md. |
| C | Safe paginated browse API and frontend; detail/reviews/seller/preview contract; cart/purchase UI; material state machine; every seller route; database analytics; honest states and real controls. | API tests for ownership/moderation/filter combinations/pagination/reviews; browser smoke for nonpayment journeys; seller chart data assertions; builds. Payment-dependent acceptance deferred explicitly. |
| D | Lock approved plan semantics/config; versioned entitlement/billing history and expiry; central minor-unit financial snapshots; discounts and independent report periods. | Boundary/rounding/multi-seller/refund arithmetic, expired quota, concurrent uploads, upgrade/downgrade tests. Paid activation remains closed until Phase F verified event integration. FINANCIAL_CALCULATIONS.md records rate sources and open approvals. |
| E | Gateway admin identity integration/UI; merchant login/profile/team/keys/webhooks/audit; reusable API-key middleware; tenant isolation; clean migration deployment. | Real isolated PostgreSQL tests with two merchants and all roles, key revoke/rotate/expiry, state changes, fresh/repeat migrate deploy. Builds and browser management journeys. |
| F | Provider-neutral adapter, explicitly isolated sandbox, payment orders/QR/intent/status; authoritative event verification; recoverable inbox/outbox/delivery; reconciliation; activate subscriptions only via verified billing events. | Sandbox buyer/subscription journeys, tampering/wrong environment/amount/currency/order tests, concurrency/retry/crash recovery, signed webhook delivery/replay and ledger correctness. PAYMENT_INTEGRATION.md documents external blockers. |
| G | Buyer/admin refund lifecycle; provider request/status evidence; immutable adjustments; seller request/reserved funds/approval/settlement reconciliation. | Partial/full refund limits, idempotency, failed provider outcomes, competing payout requests, approved settlement evidence and end-to-end financial reconciliation. |
| H | Complete admin actions/stats/reports/config/support/verification; object storage/scanner/quarantine/lifecycle adapters; thumbnails/previews/signed access; real notification production/history/preferences. | Admin authorization matrix, private access/expired URL/scanner failure tests, notifications/retries/read state, managed content and real CSV exports; browser controls tested. |
| I | Full buyer/seller/admin/gateway Playwright journeys; CI service containers/test DB guards; dependency/security checks; deploy/runbook/observability/backup restore/accessibility and load checks. | Executed E2E/security/CI/restore results in reports with logs and limitations. No readiness approval while critical dependencies or acceptance failures remain. |

Phases C/D may provide interfaces for future F/H behavior, but must not claim final payment, storage or notification acceptance early. Keep tests alongside implementation in B–H; Phase I expands system-level coverage rather than postponing all testing.

## Verification performed and limitations

Actual Phase A actions: read repository/PDF, inspect source/tests/workflow, inspect tracked working-tree status, and attempt tool-based verification. Python/pypdf extraction succeeded for all five pages. No dependencies were installed, no services started, no migrations/seed/export scripts executed, and no production connections attempted.

| Check | Actual result in this session |
|---|---|
| `npm run build` | Could not start: npm not recognized. |
| `npm --prefix server test` | Could not start: npm not recognized. |
| `npm --prefix gateway-api test` | Could not start: npm not recognized. |
| Node/npm command discovery | Not available on current PATH; standard Program Files nodejs paths not found in earlier inspection. |
| `docker --version`, `psql --version` | Commands not recognized. No runtime/database acceptance performed. |
| Prisma/gateway build/PostgreSQL/browser tests | Not executed; required toolchain/services unavailable. |
| GitHub Actions remote result | Not queried or verified in Phase A; README badge/history is not current acceptance evidence. |

Existing executable test definitions: MongoMemoryServer auth suite (3 test cases), financial helper (5 including parameterized cases), HMAC helper (1), PostgreSQL schema suite (5), gateway invalid-input/missing-auth suite (4). The source inventory totals 18 cases across these suites; historical README claims 14 backend cases across four files are not reconciled by the present three non-PostgreSQL test files (9 cases). Counts describe source definitions, not executed passes.

No Playwright framework or browser test suite was found. Current CI provisions PostgreSQL/Redis/MongoDB, installs packages, runs migration SQL, Prisma checks, builds and existing tests. It does not exercise merchant DB journeys, E2E, security scanning or actual queue processing. PostgreSQL tests fall back to a development URL and clean up records: add explicit isolated-test database guards before execution. Do not aim these tests at production.

## External dependencies and readiness gates

1. Development execution: available Node/npm, isolated MongoDB/PostgreSQL/Redis, Docker or equivalent local services, browser binaries. Their absence here blocks execution evidence, not software design.
2. SMTP transport/domain and deliverability confirmation; development mailbox can cover functional tests without claiming external delivery.
3. Authorized payment/refund/payout arrangements, provider contracts, sandbox credentials and webhook verification specifications. Local sandbox implementation can proceed without live credentials.
4. CA/legal approval of tax treatment, seller settlement model, fee assumptions, invoices, marketplace terms/privacy and payment obligations. No current compliance certification is made.
5. Private object storage/scanner infrastructure, lifecycle/retention policies, secret manager, monitoring/alert destinations and managed backup/restore environment.
6. Authentic testimonials, contact/social details and approved policy content; no invented content or service-level guarantees.

Readiness requires reproducible fresh builds and migrations, executed critical browser/database/security journeys, no payment/verification bypass, reconciled decimal-safe financial records, operational private storage/scanning, provider-backed evidence where required, documented restore/monitoring and explicit outstanding-risk decisions. A completion percentage is not an acceptance gate.

## Phase A delivery and approval boundary

Created `REMAINING_WORK_AUDIT.md` and current `IMPLEMENTATION_AUDIT.md`. No application files modified. Other final deliverables will be created/maintained in their owning phases: FINANCIAL_CALCULATIONS (D), PAYMENT_INTEGRATION (F), SECURITY_REVIEW (B onward), END_TO_END_TEST_REPORT, GITHUB_ACTIONS_REPORT and PRODUCTION_READINESS_REPORT (I, with interim evidence as work proceeds).

Historical Phase A boundary: documentation was delivered and the user subsequently approved Phase B. The Phase B evidence below supersedes the original missing-Node limitation. No approval for live payments, production writes or database cutover is inferred.

## Phase B update ? 2026-11-12

Authentication implementation delivered. See [PHASE_B_AUTH_SECURITY_REPORT.md](PHASE_B_AUTH_SECURITY_REPORT.md) and [SECURITY_REVIEW.md](SECURITY_REVIEW.md). A temporary Node runtime enabled actual tests: 35 marketplace/unit cases, 13 gateway cases and two real Chrome auth journeys passed (50 distinct cases). Gateway behavior tests use mocked persistence; four actual PostgreSQL cases are skipped. SMTP configuration is tested via mocks and development mail locally; external SMTP delivery is unverified. Backend/frontend/gateway builds and Prisma validation passed.

Known unresolved acceptance dependencies: gateway migration/persistent auth tests, real SMTP delivery, production TLS/cookies/proxy/shared rate limits and remaining npm advisories (server 7, gateway 6). Original business/payment/storage findings remain outside Phase B. The historical Phase A test inventory and unavailable-tool table above are retained as dated baseline, not current results. No production database/data changes or live payment processing occurred. Phase C has not started; await user approval.
