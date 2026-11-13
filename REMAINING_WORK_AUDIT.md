# Noteora remaining work audit - through Phase E.1

Baseline audit: 2026-11-12. Updated 2026-11-13 (Asia/Calcutta), Phase E.1. Decision: **incomplete; not production ready**.

This document retains the dated Phase A baseline and incorporates Phase B/C/D/E verification. Phase E.1 remediation is delivered after acceptance of Phase E. Fresh isolated PostgreSQL databases received gateway migrations and a logical restore check; temporary Redis, MongoDB and real browser suites supplied development evidence. No production data, existing database or live payment configuration changed. Phase F requires approval.

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

At the original Phase A review no full product requirement was classified C because execution was unavailable. C entries below now reflect the subsequent Phase B/C/D executed evidence. Existing tests are recorded separately; this does not erase historical results. Software interfaces and sandbox work remain actionable even when production integrations are X. Requirements below split compound plan statements into individually assessable capabilities; added requirements from the current request are identified by their phase.

## Original plan coverage: accounts and buyer journeys

| ID | Requirement (PDF pages) | Status | Current evidence / remaining work | Phase |
|---|---|---|---|---|
| A01 | Signup and login (1,4) | C | Existing forms/API plus normalized login, duplicate/invalid input tests and real browser registration/login passed in Phase B. | B |
| A02 | Buyer/seller/both identity and educator/student profile (1) | P | Shared USER account can upload/buy; no educator/student profile fields. Guest browsing exists; guest checkout is absent. | B,C |
| A03 | Name, contact details, profile editing (1,4) | C | Buyer/seller name, bio, university and private phone editing persist; API/browser checks pass. Avatars remain later storage scope. | C,H |
| A04 | Email verification or OTP/social alternative (4) | C | Secure single-use expiring email-token flow and browser verification passed. Actual SMTP delivery is separately blocked under R03; social login remains an optional alternative. | B |
| A05 | CAPTCHA / signup bot prevention (4) | N | Generic API rate limit exists; no CAPTCHA integration. | B,I |
| A06 | Personalized dashboard (4) | C | Personalized seller dashboard, owned purchases, profile and role-aware navigation exercised against real API/MongoDB. | C |
| A07 | Browse approved notes (1,5) | C | Only approved notes returned by real database queries; integration/browser cases pass. | C |
| A08 | Search title/description/tags (1,5) | C | Bounded escaped search through actual MongoDB, URL-preserved combined filters and browser error/Retry checks pass. | C |
| A09 | Subject/course/category filters (1,5) | C | Subject/category/course filters query stored identities/values; real API/browser combination checks pass. | C |
| A10 | Academic-level, price and instructor filters (1) | C | Academic-level, min/max price and instructor filters implemented in MongoDB; combined integration and browser filter checks pass. | C |
| A11 | Sorting popularity/date; grid/list (5) | C | Grid browsing with six deterministic sort modes and bounded pagination passes real integration/browser tests; a separate list-toggle is optional. | C |
| A12 | Note cards: title, author, thumbnail, price, rating (1,5) | C | Actual thumbnails, title/author/price and database review aggregates render; public DTO strips private paths. | C,H |
| A13 | Full description, seller bio and average rating (1,5) | C | Detail description, seller biography/university, material and seller-wide review averages and published-note count derive from database records. | C |
| A14 | Permitted PDF preview (1,5) | C | Separate explicitly permitted excerpt is public only after approval; unpublished assets require owner/moderator authentication. API/browser checks pass. | C,H |
| A15 | Detail reviews/FAQ tabs and related notes (5) | P | Descriptions, verified reviews and related notes implemented/tested. FAQ content and a separate FAQ tab remain later site-content work. | C |
| A16 | Cart add/manage items (1,5) | C | Multi-item cart preserves additions, deduplicates concurrent writes, removes items, caps 100 and rejects unavailable notes. API/browser tests pass. | C |
| A17 | Checkout totals including configured taxes/fees (1,3,5) | P | Version-2 backend quotes/snapshots and UI breakdown tested. Tax and gateway policies explicitly unresolved by default; approved professional/business decisions required before checkout. | D,F |
| A18 | Payment checkout and confirmation (1,5) | P | Read-only status/return never confers payment. Unpaid sandbox preparation and signed test evidence verified; no authorised-provider checkout/live collection. | F |
| A19 | Live payment methods (UPI/card as supported) (5) | X | Requires authorized provider agreement, credentials and supported methods; no operational provider confirmed. | F |
| A20 | Purchase transaction history (1,4) | C | Owned purchase history and status/actions tested; one buyer cannot view another buyer order history. | C,F |
| A21 | Paid purchase download links (1,4,5) | C | Buyer/order/material/expiry-bound signed downloads work in browser and API, reject tampering and retain archived paid PDFs. | C,H |
| A22 | Verified-purchase rating/comment form (2,5) | C | Buyer review form/API validates paid ownership, integer ratings and duplicates; real browser review journey passes. | C |
| A23 | Review display and seller ratings (1,2,5) | C | Public material/seller averages, detail review list and buyer/seller review pages use stored paid-purchase review records. | C |
| A24 | Account password/payment-method settings (4) | P | Password change/recovery and revocation tested in Phase B; payment-method management remains absent. | B,C,F |
| A25 | Subscription status, change and payment history (4,5) | P | Shared subscription status/history/cancellation and paid evidence-bound contract lifecycle tested. Actual payment collection remains external/later phase. | D,F |

## Original plan coverage: seller, plans and finance

| ID | Requirement (PDF pages) | Status | Current evidence / remaining work | Phase |
|---|---|---|---|---|
| S01 | Any user becomes seller by uploading (2) | C | Authenticated USER uploads via real multipart API/browser; buyer/seller shared identity preserved. | C |
| S02 | PDF upload/title/description/course tags/price (1,2,4) | C | PDF/thumbnail/separate preview and complete note metadata upload tested with actual files; invalid data cleanup verified. Word remains optional competitor context. | C,H |
| S03 | Five free uploads then subscription (1,2,3,4) | C | Transactional lifetime quota of five, concurrent last-slot enforcement and deletion-not-restoring usage tested; shared upgrade workspace exposes plans. | D |
| S04 | Read uploaded notes/status/stats (2,4) | C | Owner material/status pages show stored views and paid-order-derived per-note sales; dashboard/analytics and paging tested. | C,F |
| S05 | Edit note description/price (2) | C | Owned draft/rejected metadata edits, optional category clearing and archive-to-draft workflow tested; publication always requires moderation. | C |
| S06 | Delete unpublished material (2) | C | Unpublished unreferenced records and their files can be deleted; order references prohibit deletion and conditional state writes detect conflicts. | C,H |
| S07 | Pending approval, publish, rejection feedback (2) | C | Pending approval/rejection feedback, resubmission, separate metadata edit/moderation and preference-aware in-app records exercised. | C,H |
| S08 | Plagiarism/spam/duplicate quality checks (1,2) | N | No scanning or duplicate detection workflow; manual moderation alone does not establish this. | H |
| S09 | Sales count and earnings per note (2) | P | Version-2 all-item seller ledger/net and real per-note sales tested; legacy unaccounted net flagged/excluded, provider/settlement remains later. | C,D,F |
| S10 | Pending payouts and minimum-balance withdrawal (2) | P | Ledger status display only; no minimum balance/request/reservation/approval flow in MongoDB API. | G |
| S11 | Provider withdrawal/local transfer (2) | X | Provider/approved settlement arrangement required; no external transfer capability established. | G |
| S12 | Base note price <= INR 150 (1,3) | C | Backend exact minor-unit price parsing, INR150 cap and calculation boundary tests executed. | D |
| S13 | Transparent commission and tax breakdown (3,4) | P | Integer snapshots, plan-specific commission and tax/fee breakdown tested. Actual statutory tax policy requires CA/legal approval; no implicit zero GST. | D |
| S14 | Professionally approved tax treatment (3) | X | PDF tax example is not accepted policy; CA/legal review needed for GST base, liability, invoicing and settlement treatment. | D,G,I |
| S15 | Free plan: 5 uploads, 30% fee (4) | C | Canonical Free five lifetime creations/30% default; backend concurrent quota and entitlement tests pass. | D |
| S16 | Pro: INR 199/month, ~15 monthly uploads, ~20% fee (4) | P | Pro INR199/15 per paid period/20% canonical contract tested, including expiry and renewal. Actual paid purchase depends on provider integration. | D,F |
| S17 | Ultra: INR 499/month, unlimited uploads, ~10% fee (4) | P | Ultra INR499/unlimited/10% canonical contract and >100 uploads tested. Actual paid collection remains blocked. | D,F |
| S18 | Featured listings, premium/basic analytics (4) | C | Basic analytics retained; verified paid featured eligibility and premium financial CSV entitlement enforced/tested server-side. | C,D |
| S19 | Priority support/review, newsletters/marketing boosts (4) | N | Described as examples/possibilities; no implementation. Do not advertise guaranteed service levels without operational capacity. | C,H |
| S20 | Subscription recurring billing, trials/overdue state (2,4,5) | P | Verified term queueing, expiry, cancellation/suspension and renewal eligibility tested. Automatic recurring debit, trial/overdue business rules not implemented. | D,F |
| S21 | Platform profit/commission and gateway fee accounting (3,4) | P | Central exact commission/fee/seller allocation, reconciliation and bounded refund adjustments tested; live approved fees/taxes and settlement remain unresolved. | D,G |

## Original plan coverage: administration and public pages

| ID | Requirement (PDF pages) | Status | Current evidence / remaining work | Phase |
|---|---|---|---|---|
| M01 | Secure admin portal and role enforcement (2,5) | P | Phase B backend revalidates current role/account/session and rejects unauthorized access. Full admin browser/management acceptance remains H/I. | B,H |
| M02 | Users/active sellers/monthly revenue/recent uploads overview (2,5) | P | Real seller/material/paid-order counts and monthly series tested. A complete recent-upload/user-trend admin overview remains later admin scope. | H |
| M03 | Historical sales/user charts (2,5) | P | Seller and admin sales series now database-backed. Dedicated historical new-user chart remains later admin scope. | C,H |
| M04 | User CRUD, deactivate and plan override (2,5) | P | Phase B protects privileged accounts, restricts role creation and parses account booleans; broader admin CRUD/browser acceptance remains H. | B,H |
| M05 | User filters/detail/activity history (2,5) | P | Generic client-side record search and activity/session APIs; no joined per-user detail/date/role workflow. | H |
| M06 | Content approval/rejection with feedback (2,5) | C | Role-enforced preview/full-source review, feedback, approval/rejection, search/pagination and conflict transitions verified by API/browser. | C,H |
| M07 | Admin manually edit/remove any note (2,5) | C | Authorized metadata editing is audited and returns published notes to pending; archive/unreferenced delete retention and private assets tested. | H |
| M08 | Orders/transactions filter date/user and track sold notes (2,5) | P | Listing exists; generic text search only; no complete typed filters/detail journey. | H |
| M09 | Revenue vs commission vs payouts (2,5) | P | Real version-2 revenue/commission/refund/independent IST period reporting tested. Manual PAID overrides removed; payout reporting depends on Phase G. | D,G,H |
| M10 | Admin configurable plan prices/limits/fees/featured (2,5) | C | One immutable versioned catalog drives APIs/UI/quotas; SUPER_ADMIN edits require reason/expected version and preserve purchased terms; browser/API tested. | D,H |
| M11 | Admin billing trials/active/overdue (2) | P | Member status/history and audited suspend/resume/cancel verified contracts tested; trial/overdue/automatic collection not supplied. | D,H |
| M12 | Category/subject CRUD (2,5) | P | Category CRUD exists; subject is free text; active field rendered but absent in schema. | C,H |
| M13 | Site announcements/blog/FAQ/contact configuration (2) | N | No managed configuration endpoints or UI. | H |
| M14 | Reported reviews/users and moderation actions (2) | P | Review.reported field only; no reporting/action journey. | H |
| M15 | Upload/user/approval reports and CSV export (2,5) | P | Finance CSV endpoint exists, JSON serialization is not robust CSV escaping; UI has no export/date controls or usage reports. | H |
| M16 | Landing hero/CTA and how-it-works (4) | U | Existing responsive animated sections; four steps rather than example three is acceptable. | C,I |
| M17 | Featured/new notes/categories and carousel/sliding cards (1,4) | P | Real newest-note feed and animated category links implemented; full plan-controlled featured merchandising remains D/H. | C |
| M18 | Testimonials (4) | N | No verified testimonial content; do not fabricate testimonials. | H |
| M19 | Pricing section (4) | P | Exists but plan benefits/limits duplicated and inconsistent with plan/API behavior. | D |
| M20 | FAQ (4) | N | No functional FAQ content/management. | H |
| M21 | Footer contact/terms/social; terms/privacy links (4) | P | Branding/copyright footer only; consent text lacks complete policy content/navigation. | H,I |
| M22 | Cream/black/orange style, animations, rounded cards (5) | C | Existing cream/black/orange responsive design, animation and cards build and render in Chrome evidence; no redesign introduced. | C,I |
| M23 | Responsive, accessible pages/navigation (4,5) | P | Buyer/seller desktop and 390px mobile navigation and overflow checks pass. Full accessibility/multi-browser certification remains I. | C,I |

## Current-request extensions and gateway readiness

| ID | Requirement | Status | Evidence / missing behavior | Phase |
|---|---|---|---|---|
| R01 | Hashed single-use expiring verification tokens | C | 24-hour hashed verification tokens atomically consumed; invalid/expired/reused/concurrent/resend/bypass and browser checks passed. | B |
| R02 | SMTP email delivery with honest development adapter | U | Development mailbox exercised by real API/browser tests; configurable TLS SMTP submission covered with mocked transport, not real delivery. | B,H |
| R03 | Actual SMTP delivery | X | SMTP credentials/domain configuration and delivery verification required. | B,H |
| R04 | Reset token expiry/single use and recovery UI | C | One-hour reset tokens, atomic consumption, replacement/invalidation, session revocation and recovery/reset browser journey passed. | B |
| R05 | Refresh rotation, revocation, security activity | C | Marketplace session listing/revoke/logout-all, access expiry, refresh rotation/reuse/concurrency and password-change revocation tests passed. | B |
| R06 | Cookie CSRF and current account/role enforcement | C | Marketplace CSRF/current role/status checks pass; merchant persistence/refresh replay and suspension also pass on fresh isolated PostgreSQL. | B |
| R07 | Paginated, safe backend marketplace queries | C | Safe bounded backend search/filter/sort/pagination and invalid query handling tested against actual MongoDB. | C |
| R08 | Draft/archive lifecycle | C | DRAFT/PENDING/APPROVED/REJECTED/ARCHIVED persist in MongoDB with enforced transitions; API/browser lifecycle checks pass. No PostgreSQL cutover. | C |
| R09 | Seller dashboard/upload/materials/sales/earnings | P | All seller routes render working data/forms; upload/material/sales/dashboard and recorded earnings verified. Provider payout/financial correctness remains G/D. | C,G |
| R10 | Seller analytics/reviews/promotions | C | Database analytics/reviews/promotion CRUD retained; scoped backend discount application and invalid/expired/foreign promotion rejection tested in D. | C,D |
| R11 | Seller subscription/profile/settings/support | P | Profile/preferences/password/support retained; subscription status/history and cancellation tested in D. Operational support replies/profile assets remain H. | B,C,H |
| R12 | Central plan config; purchase/expiry/renewal/history | P | Canonical versioned catalog and verified contract purchase linkage/expiry/queued renewals/history tested; real provider collection/automatic billing remain blocked. | D,F |
| R13 | Decimal-safe central finance and refund/settlement math | P | Central exact minor-unit finance and confirmed-refund adjustments tested; actual provider refund and settlement workflows remain G. | D,G |
| R14 | Authenticated gateway admin approval/rejection UI | C | Real marketplace admin introspection, search/detail and reason-required expected-status approval/rejection/suspension/reactivation tested in API/browser; transactional audit history. | E |
| R15 | Merchant registration/login/profile backend | C | Registration, hashed owner credentials, sessions, business/contact profile and renewed review on identity changes exercised against isolated PostgreSQL. | E |
| R16 | Merchant team endpoints and UI | C | Single-use expiring hashed invitations, owner/admin/developer/viewer roles, scoped role/revocation checks and last-owner protection tested; invitation/viewer UI browser passed. Email dispatch not configured. | E |
| R17 | API-key creation/rotation/revoke/list | C | Crypto key generation, hashed persistence, once-only response, serialized per-environment rotation, expiry, scoped revocation and metadata listing tested. LIVE is provisioning only, no resource access. | E |
| R18 | API-key request authentication middleware | C | Reusable API-key middleware protects integration/context and compatibility verify, enforces exact environment/current approval/expiry; live resources denied. | E |
| R19 | Cross-merchant isolation acceptance tests | C | Two real merchant identities in one isolated PostgreSQL database exercise member, credential, endpoint, delivery and admin boundaries; separate merchant/admin authentication retained. | E |
| R20 | Merchant audit history and actionable developer UI | C | Functional merchant profile/team/keys/webhooks/delivery/activity/docs and admin review/oversight UI; role/scoped audit entries and SQL audit immutability tested. | E |
| R21 | Webhook configuration | C | Scoped endpoint registration/edit/disable/subscriptions, validated destinations and encrypted once-only secrets tested; only gateway.test subscriptions supported until future payment phase. | E |
| R22 | Fresh migration deployment and repeat deploy | C | Guarded explicit development entrypoint preserves history/checksums and passes fresh/repeat deployment, rejection of nonlocal/untracked/failed history, isolated bare-ordering reproduction and16-table logical restore. Production procedure remains separately unapproved. | E,I |
| R23 | Gateway payment orders, dynamic QR, intent/status | N | Prisma models only; gateway API implements no order/payment endpoints. | F |
| R24 | Isolated sandbox provider and authorized adapter interface | N | Marketplace client calls an external contract; no local sandbox/provider abstraction. | F |
| R25 | Production provider verification | X | Authorized arrangements, sandbox/live credentials, signing contracts and approvals unavailable/unverified. | F |
| R26 | Signed outbound delivery, durable outbox/retries | P | Signed gateway.test producer, durable delivery/outbox, BullMQ Redis recovery/retry/attempt logs and duplicate prevention tested; actual payment event producers/live delivery remain Phase F. | F |
| R27 | Incoming idempotent payment/ledger processing | P | Signed sandbox exact amount/currency/env and atomic event/order/all-item ledger processing/replay conflict tests pass. Production provider delivery remains F. | F |
| R28 | Reconciliation | P | Version-2 snapshot/ledger/refund reconciliation implemented/tested; operational provider reconciliation worker and legacy remediation remain later. | F,G |
| R29 | Refund request/approve/reject/status/provider adjustments | P | Audited request/approve/reject review with exact amounts and no COMPLETED override; internal confirmed accounting tested. Buyer/provider execution lifecycle remains G. | G |
| R30 | Payout request/approval/reserve/status/reconciliation | N | PostgreSQL settlement model does not implement MongoDB marketplace workflow. | G |
| R31 | Authoritative payout/refund execution | X | Authorized provider or documented approved settlement evidence required. | G |
| R32 | Seller verification/admin workflows | P | Actual sellers only, independent seller verification and privileged-target checks tested. Document/KYC lifecycle remains H. | H |
| R33 | Private PDFs and signed downloads | P | Private disk uploads, public path-free responses, authorized source/preview review and signed buyer downloads tested. Managed object storage/scanning/versioning remains H. | H |
| R34 | Object storage, thumbnail serving/lifecycle adapters | N | Disk uploads only, private thumbnails lack working serving workflow; no object-store abstraction. | H |
| R35 | Production object-store service | X | Bucket, credentials, encryption/retention and access policies needed. | H |
| R36 | Size/type validation and malware quarantine integration | P | PDF/image signature and size checks, upload cleanup and private assets tested. Full parsing, malware quarantine/scan interface remains H. | H |
| R37 | Operational malware scanning | X | Scanner service/engine and policy required; missing interface remains software work. | H |
| R38 | Email/in-app notifications and history | P | Moderation emits preference-aware in-app records; settings/history work. Email/realtime/read-state notification delivery still H/external SMTP. | H |
| R39 | Preserve MongoDB authority and separate gateway | U | Marketplace uses Mongoose; gateway Prisma; no application dual-write path found. Schema parity still needs reconciliation. | All |
| R40 | Buyer/seller/admin/gateway E2E suites | P | 20 real Chrome cases pass under patched tooling: auth2, marketplace9, finance4, gateway5; provider/refund/payout E2E remains later. | I |
| R41 | MongoDB integration coverage | P | 111 ordinary backend cases pass including new deployment controls; existing real MongoDB and all browser regressions retained. Provider/payout acceptance remains later. | B–I |
| R42 | PostgreSQL integration coverage | P | 46 gateway cases include real PostgreSQL/Redis/role suites;5 separate marketplace schema cases pass. API/worker least-privilege grants, fresh/repeat/bootstrap/restore verified on disposable DBs only. | E,I |
| R43 | CI builds/schema/database/security/browser checks | P | 182 distinct tests, three builds, schema/config loader and clean installs pass; application full/runtime npm audits and lockfile scan0. CI procedure updated but remote run/container builds not executed. | I |
| R44 | Deployment/monitoring/secrets/backup/restore evidence | P | Deployment policy, safe logs/errors, loopback Compose, non-root Dockerfiles, health/shutdown and explicit runtime grants implemented/prepared. Container critical/high findings, historical export exposure, real TLS/ACL rollout and full backup/PITR remain production blockers. | I |

## Phase A findings (historical; resolutions tracked in dated updates)

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

## Phase C update ? 2026-11-13

See [PHASE_C_MARKETPLACE_REPORT.md](PHASE_C_MARKETPLACE_REPORT.md) for the final feature inventory, changed files, test results, screenshots, reproduction commands and remaining limits. The checkout already included Phase C foundation modules; they were inspected, verified and extended, not rebuilt.

Phase B verification follow-up passed: PostgreSQL 16.15 was started in a new disposable loopback cluster; Phase 5B, Phase 5C and authentication SQL applied; three auth columns checked; four persistent gateway auth tests passed; server stopped. No existing/production database was touched. SMTP configuration is absent, so real email delivery remains external.

Phase C provides actual query search/filter/sort/pagination, permitted excerpts/thumbnails, seller details/review aggregates, multi-item cart, owned purchase history/protected downloads/reviews, enforced draft/review/archive lifecycle, database analytics with independent IST periods, profile/preferences/support and authorized paginated moderation/seller management. Seller/admin metadata edits require renewed moderation for previously public material, and order-referenced PDFs are retained. A success URL is now only a read-only purchase-record view and cannot establish payment success.

Executed evidence: 63 ordinary marketplace/unit tests, 13 gateway behavior/security tests, four real PostgreSQL tests, two auth browser tests and nine marketplace browser tests (91 distinct executed cases). All three application builds pass. Existing stored-PAID fixtures were used exclusively in disposable MongoDB to test entitlements; provider/payment verification is not certified. Screenshots are under docs/evidence/phase-c.

Dependency review: server 2 critical/4 high/1 moderate; gateway 2 critical/3 high/1 moderate; client zero. Omit-dev still reports four server and three gateway high package nodes in the Prisma-related graph; these cannot be dismissed as tooling-only. No dependency versions changed in C. See the Phase C report for exact package classification.

Financial/subscription plan rules, payment processing, payouts/refunds, object storage/malware scanning, SMTP/realtime notifications, production operations and broader accessibility/scale work remain unresolved in their planned phases. No payment/financial service or order-processing route code changed. No live payment or production cutover enabled. Phase C is delivered for review; stop before Phase D pending approval.

## Phase D reconciliation addendum (current)

See [Phase D report](PHASE_D_SUBSCRIPTION_FINANCIAL_REPORT.md), [financial specification](FINANCIAL_CALCULATIONS.md) and [subscription specification](SUBSCRIPTIONS.md). Earlier dated observations about fixed30%, zero GST, lost same-seller lines or manual status overrides are historical findings now corrected for version-2 paths. Legacy data is not migrated or certified. Both tax and fee policies remain UNRESOLVED until approved. No live provider, payout, production migration or cutover was performed. MongoDB transactions require a replica set; standalone writes fail closed. Phase E has not begun.

## Phase E reconciliation addendum (current)

[Delivery report](PHASE_E_GATEWAY_MERCHANT_REPORT.md) and [API documentation](docs/gateway/API.md) supersede historical statements that team management, key middleware, administrator controls and outbound webhook infrastructure are absent. The only implemented producer is explicitly nonfinancial gateway.test; payment orders/providers and live event production remain N/X in Phase F. Merchant status is administratively reviewed, not regulatory authorisation. SMTP invitation dispatch, production deployment/egress/backup operations and dependency remediation remain blockers. MongoDB authority is unchanged. Stop after E; F requires approval.

## Phase E.1 current remediation evidence

[Security remediation report](PHASE_E1_SECURITY_REMEDIATION_REPORT.md): application advisory nodes resolved with patched dependencies; final npm/lockfile scans0. Actual image scanning retains3 critical/83 high base-image occurrences, with proposed changes unverified until builds/rescans. Historical export authentication material was found; current exports are untracked/preserved locally but history/revocation review remains open. No clean-production/security-clear claim. Migration ordering remains documented; shared guarded development deployment/recovery checks pass. No Phase F or provider integration has begun.
# Phase E.2 security gate addendum — 2026-11-13

Final evidence and container status: `PHASE_E2_FINAL_SECURITY_GATE_REPORT.md`. Earlier phase statements remain historical; this addendum grants no production or Phase F approval.

| Requirement | Current classification | Evidence / remaining work |
| --- | --- | --- |
| Preserve and isolate historical exports | COMPLETE AND TESTED |16 byte-integrity/ACL checks; archive outside workspace; no export paths in current index/HEAD. |
| Reject legacy verification/session bypass shapes in current API | COMPLETE AND TESTED |Two new synthetic MongoDB tests; no actual historical credential replay. |
| Establish source-account provenance and password/token validity | BLOCKED BY EXTERNAL DEPENDENCY |Owner answer: Unknown — keep under review. Offline code/snapshot review cannot attest to deployments. |
| Credential rotation/revocation and coordinated history cleanup if required | BLOCKED BY EXTERNAL DEPENDENCY |Requires explicit owner decision/approval; checklist supplied; nothing executed against accounts/history. |
| Repository, generated outputs and build-context known-value checks | COMPLETE AND TESTED within documented scope |Current archive/output checks, redacted Gitleaks and real Docker canary; external releases/deployment logs remain unverified. |
| Full application/security regression, schema validation and migration guards | COMPLETE AND TESTED within development scope |184 distinct tests, all three native builds, Prisma validation and repeated isolated migration/restore checks. Final Linux image/runtime findings recorded separately. |
| Production image/security acceptance | PARTIALLY IMPLEMENTED |See final image register and residual risks; rebuilt does not imply vulnerability-free or production-approved. |
| Production TLS, least-privilege deployment, encrypted/PITR recovery, operational monitoring and external artifact review | BLOCKED BY EXTERNAL DEPENDENCY |Requires actual production infrastructure/owner verification; no production system accessed. |

Phase F remains unstarted. MongoDB remains the authoritative marketplace database. E.2 introduces no database migration/cutover, live UPI processing, provider credentials or settlements.

