# Noteora — Phase 5C Final Acceptance and Phase 5D Readiness Audit

Audit date: 2026-11-09  
Repository: `d:\NOTEORA`  
Audit scope: source code, documentation, build/test execution, Docker configuration and security review

## Executive Decision

- **Phase 5C acceptance:** **NOT ACCEPTED** in final form
- **Phase 5D readiness:** **NOT READY**
- **Production cutover:** **NOT APPROVED**
- **Live payment enablement:** **PROHIBITED / NOT IMPLEMENTED**

The repository contains a substantial merchant-management foundation, but the merchant admin and developer dashboards are not fully functional, gateway database migration is not fully automated, current gateway JWT and fallback secret handling is unsafe, and merchant-team management is only partially present.

## Overall Implementation Percentage

A source-evidence estimate is appropriate rather than an executable completion claim:

| Area | Estimate | Evidence basis |
|---|---:|---|
| Merchant registration and login | 85% | Real Prisma endpoints and password hashing exist |
| Merchant approval workflow backend | 80% | Status endpoints exist; no browser-integrated authenticated admin UI |
| Merchant dashboard/API actions | 55% | Profile, key, webhook and activity APIs exist; team UI and several dashboard actions are missing |
| API key management | 75% | Generation, hashing, verification, rotation and revocation exist; integration coverage is limited |
| Merchant RBAC | 65% | Role middleware exists, but JWT claims are stale and not revalidated |
| Webhook configuration | 70% | Configuration and encrypted secrets exist; decryption/retrieval, delivery and rotation history are incomplete |
| Audit logging | 80% | Gateway audit log writes exist for major actions |
| Marketplace product implementation | 75–80% | Core routes and UI exist, but full database/browser journeys were not run |
| Security hardening | 55% | Tests and middleware exist, but critical secrets, privilege escalation and stale sessions remain |
| Migration/operational hardening | 75% | SQL migrations and tests exist; fresh automated migration deployment and restore evidence remain limited |

**Repository implementation estimate: approximately 68–72% of a complete regulated production MVP.**

This is not a claim that Phase 5C is complete or production-ready.

## 1. Code Verification

### Merchant registration and onboarding

**Status: Mostly implemented; untested end-to-end.**

Evidence:

- Gateway registration creates a merchant and owner transactionally in [gateway-api/src/index.ts](/d:/NOTEORA/gateway-api/src/index.ts:53).
- Registration returns the application status and does not create a payment capability.
- Passwords use bcrypt with 12 rounds.
- Merchant onboarding status values exist in Prisma.

Limitations:

- No complete registration UI.
- No email verification or business-document workflow.
- No merchant-team invitation workflow.
- Registration uniqueness and merchant-status behavior require database integration tests beyond the current unit suite.

### Admin approval and rejection

**Status: Backend implemented; UI disconnected.**

Evidence:

- Admin merchant listing, overview and status update endpoints exist in [gateway-api/src/index.ts](/d:/NOTEORA/gateway-api/src/index.ts:109).
- Rejection requires a reason.
- Status changes are audited.

Limitations:

- Gateway admin React fetches merchant endpoints without an `Authorization` token or administrator token in [client/src/GatewayPages.tsx](/d:/NOTEORA/client/src/GatewayPages.tsx).
- No approval/rejection/suspension/reactivation buttons exist in the UI.
- The static bearer-token administrator design is separate from the normal marketplace admin JWT and is not appropriate for normal merchant access control.

### Merchant dashboard actions

**Status: Partially implemented.**

Evidence:

- Gateway merchant backend supports profile, API keys, webhooks and activity.
- The merchant dashboard in [client/src/GatewayPages.tsx](/d:/NOTEORA/client/src/GatewayPages.tsx) is currently four informational cards only.

Missing:

- Login/register form in the merchant UI.
- Profile editing.
- API key generation/listing/revoke actions.
- Webhook create/update/enable UI.
- Security settings.
- Team management.
- Activity rendering from the activity endpoint.

### API key generation and authentication

**Status: Implemented but not fully integration-tested.**

Evidence:

- API keys are generated with separate `nk_test_` and `nk_live_` prefixes.
- Only secure hashes are stored.
- Creation rotates active credentials by environment.
- Verification checks hash, expiry, environment and approved merchant status.
- Revocation is supported.
- Generation is audited.

Limitations:

- The key-verification route is a password-like credential exchange, not middleware for gateway resources because no payment resources exist.
- Key expiry and role behavior lack live database tests.
- Live credentials are currently structurally separated but not provider-verified or operationally restricted to production deployment.

### API key rotation and revocation

**Status: Implemented in API.**

- Rotation revokes/deactivates previous active credentials for the same environment.
- Revoke is merchant-scoped and owner/admin protected.

No gateway UI calls these endpoints.

### Test/live environment separation

**Status: Implemented structurally.**

- Separate `SANDBOX` and `LIVE` enum values exist.
- Separate prefixes and separate active credential replacement by environment exist.
- Credential verification requires both environment and active status.

No production-live credential policy or provider authorization is implemented.

### Merchant RBAC

**Status: Partially implemented.**

- Roles exist for owner, admin, developer and viewer.
- Route-level role checks exist for merchant profile, key and webhook operations.

Limitations:

- JWT claim role is not rechecked against the current merchant-user record.
- Merchant status is not rechecked for all merchant JWT-protected routes.
- No team-member management endpoints or UI exist.
- Viewer can list profile, keys, webhooks and activity because these routes do not require explicit role restrictions. Depending on requirements, that may be a least-privilege issue.

### Cross-merchant data isolation

**Status: Mostly scoped, untested with real merchant records.**

- Merchant identity is normally taken from the JWT `merchantId`.
- Credential revoke and key/webhook queries include `merchantId`.
- No cross-merchant tests create two merchants and attempt object access beyond the gateway security unit tests.

This requires an automated integration suite before acceptance.

### Webhook configuration

**Status: Implemented in API; not delivered.**

Evidence:

- Endpoint URL, environment, active flag, event subscriptions and secret are created in the database.
- One endpoint is selected per merchant/environment.
- AES-256-GCM encryption is used.
- The plaintext secret is returned once.

Limitations:

- No separate PUT rotate-secret endpoint.
- No secret decryption operation exists for delivery workers.
- No webhook delivery worker, retry policy, signature delivery or event history exists.
- Secret values returned by create/update are not usable in the static dashboard.

### Audit logging

**Status: Implemented for gateway actions.**

Audited actions include registration, login, profile update, status changes, API key rotation/revoke and webhook configuration.

The audit action records IP and entity identifiers. Separate marketplace audit logging also exists.

### PostgreSQL migration deployment

**Status: Implemented as SQL; fresh deployment automation is not fully established.**

Evidence:

- Marketplace migration exists under `database/prisma/migrations/20261108175257_phase5b`.
- Phase 5C migration exists under `database/prisma/migrations/20261108_phase5c`.
- A development database migration was reportedly applied manually.

Limitations:

- Migration deployment persistence/invariant had to be bypassed manually according to Phase 5C documentation.
- The CI workflow originally omitted PostgreSQL migration application; it has now been updated in this audit to apply both migration SQL files in a fresh service database before tests.
- No executed migration result from a fresh CI database is available yet; the workflow update requires a future successful GitHub Actions run.

## 2. Marketplace Verification

### Verified and passing source execution

The following ran successfully on the current development environment:

- Backend unit/integration tests: **14/14 passed across 4 files**
- PostgreSQL integration tests: **5/5 passed**
- Gateway security tests: **4/4 passed**
- Backend TypeScript build: passed
- Frontend production build: passed
- Gateway TypeScript build: passed
- Prisma schema validation: passed
- Prisma client generation: passed
- Docker Compose configuration: passed

The repository also contains authentication API integration coverage.

### Buyer registration and login

Backend registration/login routes exist and an actual test registers, rejects duplicate email and logs in in [server/src/index.test.ts](/d:/NOTEORA/server/src/index.test.ts).

Not browser-verified without a browser run in this audit.

### Seller registration and login

No separate durable seller-registration API workflow is confirmed. The marketplace may upgrade a buyer into seller/admin behavior through role fields, but there is no complete seller-application onboarding model in the verified test result.

### Material upload and approval

- Upload route performs Multer storage, magic-byte PDF validation, price validation and limits.
- The model defaults materials to pending status.
- Admin approval API exists.

Actual MongoDB browser/upload journey was not executed; no supplied running MongoDB test journey was available in this audit.

### Search

The approved-material search route supports `subject` and text search. Frontend route existence was confirmed. Actual search result accuracy was not browser/database tested.

### Cart and order creation

Routes and UI exist. Server-authoritative pricing and material validation are present in source. Full end-to-end buyer purchase was not browser-tested.

### Payment status handling

Webhook and financial services have unit coverage, including HMAC behavior. Browser success/failure pages do not establish authority.

No real provider or live webhook journey was executed.

### Protected downloads

A signed 15-minute token route is implemented. Actual paid-purchaser download access was not browser-tested with MongoDB records.

### Reviews

Review creation requires a paid order containing the reviewed material. Full UI/API test execution is absent.

### Seller earnings

Seller API, ledger model and workspace views exist, but provider payout execution is external and incomplete. Charts and historical aggregation require verification against real sales records.

### Admin moderation

Admin CRUD routes exist and the admin shell is shared by routes. Source review identifies backend moderation, but the browser journey and real MongoDB dataset were not exercised.

### Navigation

- Marketplace navigation is role-aware.
- Seller workspace has a fixed left sidebar and requested mobile navigation.
- Admin sidebar exists across admin routes.
- Gateway administration UI is incomplete.

### Identified marketplace gaps

- Admin dashboard monthly-sales chart in [client/src/App.tsx](/d:/NOTEORA/client/src/App.tsx:41) uses a static decorative array rather than actual historical data.
- Seller charts may be summary-derived and do not yet demonstrate complete historical data.
- DRAFT and ARCHIVED are seller UI concepts, but not durable MongoDB material enum states.
- Notification preferences are not yet a confirmed persistent server model.
- Promotion checkout application logic and campaign activation rules require verification.
- Full buyer/seller/admin browser journeys are not proven.

## 3. Security Audit

### Critical security findings

#### CRITICAL — Predictable fallback secrets

Evidence:

- Marketplace JWT fallback `dev-access` exists in [server/src/auth.ts](/d:/NOTEORA/server/src/auth.ts:7).
- Gateway JWT and webhook encryption fallbacks exist in [gateway-api/src/index.ts](/d:/NOTEORA/gateway-api/src/index.ts:18).
- Docker Compose fallback gateway values exist in [docker-compose.yml](/d:/NOTEORA/docker-compose.yml:49).

Impact: forged application tokens and webhook-key derivation if deployment omits secret environment variables.

Required fix: remove fallbacks and fail closed on startup.

#### HIGH — Privileged role escalation

Any marketplace `ADMIN` may create a `SUPER_ADMIN` because role values are accepted directly in the user-create route in [server/src/routes.ts](/d:/NOTEORA/server/src/routes.ts:67).

Required fix: restrict privileged role assignment to `SUPER_ADMIN` only and use explicit server-side role allowlists.

#### HIGH — Seller self-approval mass assignment

Seller `Object.assign(m, req.body)` in [server/src/routes.ts](/d:/NOTEORA/server/src/routes.ts:27) allows a seller to submit moderation fields such as status, seller, PDF path, sales or views.

#### HIGH — Unverified subscription activation

Subscription activation in [server/src/routes.ts](/d:/NOTEORA/server/src/routes.ts:51) grants PRO or ULTRA without authoritative payment verification.

#### MEDIUM — Support ticket owner override

The support route spreads the full request body after setting the authenticated owner in [server/src/routes.ts](/d:/NOTEORA/server/src/routes.ts:58), allowing `user` replacement.

#### MEDIUM — Stale gateway JWT claims and no account-status revalidation

Gateway auth verifies signature but not current role, active flag or merchant status in [gateway-api/src/index.ts](/d:/NOTEORA/gateway-api/src/index.ts:31).

### Other security observations

- Marketplace access uses a bearer JWT local-storage model and no refresh-token rotation or server-side revocation.
- API keys and webhook signing secrets are not logged by current gateway list endpoints.
- Gateway encryption key fallback and admin shared-token design are incomplete production controls.
- Database ports and Redis are loopback/password protected in Docker Compose, but Compose still contains development credential values.
- File uploads validate extension/MIME and PDF magic bytes; malware scanning, content scanning and private object storage are not implemented.
- Raw webhook validation exists in marketplace source and unit coverage exists.
- Rate limits exist on Express routes, but gateway and marketplace have no external per-merchant/provider credential rate policy.
- Input validation is inconsistent: gateway Zod usage is strong; marketplace routes rely heavily on direct `req.body` and ad hoc checks.

## 4. Testing

### Actual results

| Test/build | Result |
|---|---|
| Gateway security tests | 4/4 passed |
| Backend Vitest suite | 14/14 passed across 4 files |
| PostgreSQL integration suite | 5/5 passed |
| Marketplace API build | Passed |
| Frontend production build | Passed |
| Gateway API build | Passed |
| Prisma schema validation | Passed |
| Prisma client generation | Passed |
| Docker Compose configuration | Passed |

### Not executed or insufficiently evidenced

- Browser testing for buyer, seller, admin and gateway roles
- Merchant database integration tests
- Cross-merchant isolation test suite
- API-key rotation/revoke database journey
- Webhook configuration database journey
- Fresh disposable PostgreSQL migration deployment
- MongoDB-to-PostgreSQL actual representative migration acceptance
- Database backup restoration in a current test environment
- Redis connection and BullMQ end-to-end execution
- Docker container startup and health endpoint runtime
- Payment-provider sandbox and webhook journey

No failed source/build/test command was observed in the audit commands that were executed.

## 5. Phase 5D Readiness

**Readiness decision: NOT READY.**

Software requirements still missing or unsafe:

- Remove fallback JWT and webhook secrets.
- Fix seller mass assignment and subscription activation.
- Revalidate gateway JWT account/role/status.
- Add team-management and cross-merchant integration tests.
- Complete authenticated gateway admin and merchant dashboard actions.
- Add webhook delivery worker and secret reuse/decryption architecture.
- Add webhook event persistence and replay protection.
- Add payment order, UPI QR, intent and verification integration with provider-neutral interfaces.
- Add financial idempotency tests and reconciliation jobs.

External dependencies required outside repository implementation:

- Authorized banking or payment-provider arrangement
- Legitimate sandbox/test credentials
- Provider webhook signing keys
- QR generation/UPI provider contract
- Settlement and refund terms
- Merchant KYC/onboarding policy
- Regulated payout arrangements
- RBI/NPCI legal and compliance review
- Managed secret storage
- External provider certificate and uptime monitoring

Software engineering readiness is separate from regulatory authorization. No external dependency may justify marking payments operational before secure implementation and approval.

## 6. Fully Implemented and Tested

- Gateway invalid-route and missing-auth unit checks
- Gateway invalid registration and credential input checks
- Marketplace backend Vitest suite
- PostgreSQL connectivity, CRUD, constraints, rollback, concurrency and duplicate-check integration tests
- Backend, frontend and gateway builds
- Prisma validation and client generation
- Docker Compose syntax validation

## 7. Implemented but Untested

- Merchant registration and login database persistence
- Admin status transitions
- Key generation/verification/rotation/revoke database behavior
- Webhook endpoint configuration encryption
- Merchant audit logging
- Protected marketplace downloads
- Material approval workflow browser journey
- Cart/order/payment state browser journey

## 8. Partially Implemented

- Merchant developer/admin dashboards
- Merchant team management
- Cross-merchant isolation
- Webhook delivery
- Marketplace analytics
- Seller subscriptions and payouts
- Refresh/session security
- Input validation consistency
- Migration deployment automation

## 9. Missing Features

- Authenticated merchant dashboard login/profile/key/webhook controls
- Complete gateway team-management UI/API
- Gateway database integration and isolation suite
- Secret rotation history and delivery history
- Background webhook delivery
- Live payment order creation and dynamic QR/UPI checkout
- Payment reconciliation with authorised provider
- Real payout/refund provider lifecycle
- Production refresh-token rotation and revocation
- Malware scanning and private object-storage lifecycle
- Complete fresh-database and restore validation

## 10. Documentation Assessment

Required repository documents exist:

- `PHASE5C_REPORT.md`
- `GATEWAY_ARCHITECTURE.md`
- `GATEWAY_SECURITY.md`
- `MERCHANT_ONBOARDING.md`
- `MERCHANT_API_KEYS.md`
- `MERCHANT_PERMISSIONS.md`
- `WEBHOOK_CONFIGURATION.md`
- `DATABASE_SECURITY.md`
- `POSTGRESQL_TESTING.md`
- `MIGRATION_VERIFICATION.md`

Documentation correctly contains restrictions against live payment processing and production cutover. However, documentation overstates a few connected UI and integration capabilities; source evidence above is the controlling implementation status.

## 11. Acceptance Decision

### Phase 5C: Rejected for final acceptance

The Phase 5C merchant-management backend foundation is substantial and should not be discarded. It is not sufficient for acceptance until the following blockers are resolved:

1. Remove all JWT and encryption fallback secrets.
2. Fix privileged role creation, seller mass assignment and subscription activation.
3. Revalidate gateway JWT role/account/merchant status.
4. Connect gateway admin approval/rejection UI.
5. Implement or clearly document team management as remaining scope.
6. Add and pass actual gateway cross-merchant database integration tests.
7. Add fresh migration deployment automation and execute it in CI.
8. Execute browser journeys for gateway admin and gateway merchant dashboards.
9. Do not enable live payments until external approvals and provider credentials are supplied separately.

## 12. Security Remediation Follow-Up

The user selected **Fix all issues** after reviewing the security findings. The following fixes were applied after the initial audit:

- Marketplace JWT verification/signing now fails closed outside test mode when `JWT_ACCESS_SECRET` is absent.
- Gateway JWT and webhook encryption secrets now fail closed outside test mode when required environment variables are absent.
- Docker Compose removed development gateway and marketplace secret fallbacks and now requires explicit secret environment variables.
- Marketplace admin create and update routes now restrict privileged role assignment; only `SUPER_ADMIN` may create or assign `SUPER_ADMIN`.
- Seller material updates now use an explicit server-side field allowlist instead of unrestricted `Object.assign`.
- Paid PRO/ULTRA seller plan activation now returns `402` and creates no subscription without a verified payment flow; free plan activation remains available.
- Support-ticket creation now stores only authenticated owner, subject, message and initial status.
- Gateway merchant JWT authentication now requeries active merchant-user and merchant status records and replaces stale token role claims with current database values.

Post-fix verification:

- Backend tests: 14/14 passed.
- Gateway security tests: 4/4 passed.
- Backend, gateway and frontend builds passed.
- Docker Compose configuration passed with explicit nonproduction CI values.

Additional cross-merchant integration tests and refresh-token rotation remain future hardening work rather than fixes claimed by these unit/build results.

## 13. CI Updated

The GitHub Actions workflow has been updated to:

- Use a PostgreSQL 16 service
- Use Redis 7 and MongoDB 7 services
- Install root, server, client and gateway dependencies
- Apply Phase 5B and Phase 5C migration SQL in a fresh PostgreSQL database
- Validate Docker Compose
- Validate and generate Prisma
- Build marketplace backend/frontend and gateway backend
- Run marketplace, PostgreSQL and gateway test suites

The updated workflow should be run as a GitHub Actions check before Phase 5C acceptance. This local audit does not substitute for a successful remote Actions run.
