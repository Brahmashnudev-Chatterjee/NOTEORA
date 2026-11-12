# Phase B â€” Authentication and Account Security

Date: 2026-11-12 (Asia/Calcutta). Phase A approval received; implementation is limited to Phase B. **Implementation delivered for review; PostgreSQL gateway acceptance and real email delivery remain unverified. Phase C has not started.**

## Changes

1. Replaced the email verification bypass with hashed, expiring, atomic single-use verification. Resend invalidates old links. Admin/self-profile requests cannot mark an account email-verified. Existing verification flags/data are preserved.
2. Implemented recovery emails, fragment-based reset/verification pages, atomic reset expiry/reuse protection, password-change revocation and honest delivery status. Added configurable SMTP and a private development mailbox; no mail link is exposed through an API or application log.
3. Added MongoDB-backed marketplace sessions, strict 15-minute access JWT validation, seven-day HttpOnly refresh cookies, atomic rotation/replay detection, logout, logout-all, device listing/revocation and current account/role revalidation. Legacy cookie access and stateless tokens no longer authenticate; rollout requires existing users to sign in again.
4. Added trusted-Origin/custom-header CSRF checks for cookie-related login/register/refresh/logout; bearer auth remains the ordinary API transport. Browser access tokens now use sessionStorage; refresh secrets never enter JavaScript storage. Shared-cookie rotation is serialized in supported browsers.
5. Restricted privileged account creation/changes to SUPER_ADMIN, protected privileged targets, removed invalid self-selected roles/manual verification controls, and removed password hashes from administrator create replies. Preserved shared USER buyer/seller behavior.
6. Separated gateway merchant and marketplace administrator identities. Gateway admin requests now use live marketplace session introspection, not a shared admin token. Merchant access/refresh credentials have separate issuer/audiences, database-backed generation/family/expiry, role/status checks and logout/replay invalidation. Merchant login UI and authenticated administrator fetches use separate credential stores. Team/key management UI remains Phase E.
7. Added bounded auth rate limits, explicit reverse-proxy trust, password byte-length checks, safe security activity/errors and fail-closed production secrets. Removed Compose gateway secret fallbacks. Added only the required auth migration/CI wiring; no database deployment was performed.
8. Updated Nodemailer to 10.5.0 and Zod to 4.6.7 to address reported advisories affecting the new account/email paths; updated the existing Zod record invocation for compatibility. Added Playwright test tooling for the Phase B browser journeys. No stack change or broad forced dependency upgrade.

See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for control details, threat assumptions and residual risks.

## Actual verification

A temporary Node v22.14.0 runtime was obtained from nodejs.org under the system temporary directory. npm installs succeeded; the initial missing-tool limitation was overcome for Node. Existing Chrome was used headlessly. No Docker or psql executable was available, and no TEST_GATEWAY_DATABASE_URL was supplied.

| Command / check | Actual result |
|---|---|
| `npm --prefix server test` | **35 passed** across five files; two browser tests intentionally skipped in this ordinary run and executed separately below. Real ephemeral MongoDB was used for API integration. |
| `npm --prefix server run test:auth-browser` with required environment | **2 passed** in real headless Chrome against the real API and ephemeral MongoDB. |
| `npm --prefix gateway-api test` | **13 passed**, **4 PostgreSQL tests skipped**. Nine new gateway behavior tests use mocked persistence; four existing security checks also pass. Rerun with explicit CI-style gateway secret passed. |
| `npm --prefix server run build` | Passed. |
| `npm --prefix gateway-api run build` | Passed. |
| `npm --prefix client run build` | Passed; existing-style large-chunk warning remains (bundle about 552 kB). |
| Gateway Prisma client generation | Passed. |
| Prisma schema validation with explicit schema path | Passed; no database connection/migration required. |
| `git diff --check` | Passed. |
| Real SMTP transport/deliverability | Not executed. Adapter configuration is tested with a mocked SMTP transport; development mailbox is exercised by API/browser tests. |
| Gateway PostgreSQL auth migration / persistent session suite | Not executed; four test cases are explicitly skipped, not passed. |
| Remote GitHub Actions / Docker Compose runtime | Not executed. |

Total independently executed test cases across the final suites: **50 passed** (35 marketplace/unit + 13 gateway + 2 browser). Four gateway database cases remain unexecuted. Intermediate frontend TypeScript errors and an incorrect schema CLI path were corrected; final builds/schema checks passed. No outstanding failing assertion was observed in executed suites.

Coverage includes registration/login/duplicate and malformed inputs; valid/invalid/expired/reused/resend verification; expired/replaced/concurrent resets; access expiry/issuer/audience/algorithm; refresh rotation/replay/concurrency/expiry; logout/all-session/device ownership; inactive/suspended accounts; USER seller access/admin denial; current-role changes; privileged account protection; merchant/admin identity isolation; cookie CSRF; login throttling; safe user serialization and legacy user password changes. SMTP unit tests check TLS configuration and production rejection of the development adapter.

Browser journeys exercise the existing registration, forgot-password and login forms plus the new verification/reset pages, logout and cookie-based session restoration on reload. The browser harness emits a Tailwind content-path warning because its working directory differs from the client development command; functional assertions pass, but this run is not visual/responsive acceptance.

## Configuration and rollout

- Set JWT_ACCESS_SECRET and GATEWAY_JWT_SECRET to independent random secrets of at least 32 characters. Keep the gateway webhook encryption key separate. No secret values belong in Git or browser configuration. JWT_REFRESH_SECRET is a legacy setting; marketplace refresh tokens are opaque and hashed, not JWTs signed with that setting.
- CLIENT_URL must list exact trusted marketplace frontend origins; the first is used in email links. GATEWAY_CLIENT_URL lists exact gateway frontend origins. MARKETPLACE_AUTH_URL is a trusted internal marketplace origin (Compose uses `http://marketplace-api:5000`). Production external traffic requires HTTPS. Configure TRUST_PROXY_HOPS only for the actual trusted reverse proxy.
- For development, EMAIL_TRANSPORT=development creates private `.dev-mail/*.json` under the API process working directory, not external delivery. Files are ignored by Git and never served. Restrict NTFS ACLs on Windows. In tests, mail is held in memory only.
- For production SMTP, set EMAIL_TRANSPORT=smtp, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_FROM and optional SMTP_USER/SMTP_PASSWORD. Port 587 uses required STARTTLS by default; SMTP_SECURE=true uses implicit TLS. Complete SPF/DKIM/DMARC and actual delivery checks with the mail operator.
- Gateway auth code requires the three new MerchantUser columns from `20261112_phase_b_gateway_auth/migration.sql`. Apply only through an explicitly controlled deployment to an isolated development gateway database first. No startup migration is performed. Re-login is required for existing merchant tokens.
- Marketplace sessions are new MongoDB records; no existing production records were migrated or deleted. Existing users receive default securityVersion=0 on read; legacy password changes are tested. New verification/reset links replace prior tokens on request.
- Gateway supports one active login family per merchant user in this phase. Marketplace supports multiple independently revocable device sessions. Session expiry is absolute at seven days; refresh does not extend it.

## Exact verification commands

Run from the repository root using an available Node/npm toolchain. The temporary runtime used in this session can be selected in PowerShell, if it still exists:

```powershell
$env:PATH = (Join-Path $env:TEMP 'noteora-phase-b-tools\node-v22.14.0-win-x64') + ';' + $env:PATH
npm ci --prefix server
npm ci --prefix client
npm ci --prefix gateway-api
npm --prefix server run build
npm --prefix gateway-api run build
npm --prefix client run build
npm --prefix server test
npm --prefix gateway-api test

$env:RUN_AUTH_BROWSER = '1'
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
# Or install Playwright Chromium: npm --prefix server exec -- playwright install chromium
# Then omit CHROME_PATH to use the Playwright-managed browser.
npm --prefix server run test:auth-browser
Remove-Item Env:RUN_AUTH_BROWSER
Remove-Item Env:CHROME_PATH -ErrorAction SilentlyContinue
```

For the **unexecuted PostgreSQL verification**, first provision a fresh disposable loopback PostgreSQL database named `noteora_gateway_test` and a test-only owner. The following is an exact fresh-database sequence consistent with existing CI's SQL setup; configure PGUSER/PGPASSWORD securely outside shell history. Do not use an existing production/development data database. These commands were not executed here:

```powershell
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '5432'
# Set PGUSER and PGPASSWORD to isolated test credentials before running.
createdb noteora_gateway_test
psql -d noteora_gateway_test -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA marketplace; CREATE SCHEMA gateway;'
psql -d noteora_gateway_test -v ON_ERROR_STOP=1 -f database/prisma/migrations/20261108175257_phase5b/migration.sql
psql -d noteora_gateway_test -v ON_ERROR_STOP=1 -f database/prisma/migrations/20261108_phase5c/migration.sql
psql -d noteora_gateway_test -v ON_ERROR_STOP=1 -f database/prisma/migrations/20261112_phase_b_gateway_auth/migration.sql
# Set this via a secret-safe environment mechanism using the same test credentials:
# TEST_GATEWAY_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/noteora_gateway_test?schema=gateway
$env:DATABASE_URL = $env:TEST_GATEWAY_DATABASE_URL
npm --prefix gateway-api run prisma:generate
& .\gateway-api\node_modules\.bin\prisma.cmd validate --schema database/prisma/schema.prisma
npm --prefix gateway-api run test:auth-postgres
```

The dedicated database command refuses a missing TEST_GATEWAY_DATABASE_URL, and the suite refuses non-loopback databases or names not ending in `_test`. This raw-SQL fixture setup does not establish Prisma migrate-deploy/repeat-deploy acceptance; that broader migration check remains in Phase E. The suite deletes only its created merchant (cascading its test children).

## Outstanding dependencies and risks

- PostgreSQL gateway auth migration and four real DB tests remain unverified; this is an acceptance dependency, not a passing result.
- Actual SMTP credentials, mail-domain setup and inbox delivery evidence remain external.
- npm audit still reports **7 server** and **6 gateway** package advisories (including test-tool critical and Prisma-related high advisories). The specific Nodemailer/Zod findings were removed. Major tooling/Prisma remediation requires separate compatibility work; do not expose test runners on a network or claim production security complete.
- Production TLS/cookie/proxy behavior, shared rate limiting and a protected marketplace/gateway introspection connection need deployment validation. Remote CI was not run.
- Broader buyer/seller/admin marketplace journeys and all payment/financial/storage findings remain outside Phase B. Existing admin payment/refund status overrides were deliberately not changed under this authorization.

## Files created

- `server/src/authRoutes.ts`
- `server/src/services/emailService.ts`
- `server/src/services/emailService.test.ts`
- `server/src/auth.security.test.ts`
- `server/src/auth.browser.test.ts`
- `client/src/AccountSecurity.tsx`
- `gateway-api/test/auth.test.ts`
- `gateway-api/test/auth.postgres.test.ts`
- `gateway-api/.env.example`
- `database/prisma/migrations/20261112_phase_b_gateway_auth/migration.sql`
- `SECURITY_REVIEW.md`
- `PHASE_B_AUTH_SECURITY_REPORT.md`

## Files modified

- `server/src/auth.ts`, `server/src/models.ts`, `server/src/routes.ts`, `server/src/index.ts`, `server/src/index.test.ts`
- `server/package.json`, `server/package-lock.json`, `server/.env.example`
- `client/src/lib.ts`, `client/src/main.tsx`, `client/src/App.tsx`, `client/src/SellerWorkspace.tsx`, `client/src/GatewayPages.tsx`
- `gateway-api/src/index.ts`, `gateway-api/package.json`, `gateway-api/package-lock.json`
- `database/prisma/schema.prisma`, `docker-compose.yml`, `.github/workflows/ci.yml`, `.gitignore`, `.env.example`
- `IMPLEMENTATION_AUDIT.md`, `REMAINING_WORK_AUDIT.md` (Phase A files already existed in the working tree; updated for Phase B).

## Functionality and approval boundary

Existing application builds and existing backend/security tests pass. Real buyer registration/login, seller dashboard navigation and auth recovery/logout browser journeys remain functional in the isolated tests. No unrelated marketplace, payment, financial or storage business logic was altered. This evidence does not certify every existing page/workflow or a production deployment.

No production data mutation, production migration, PostgreSQL cutover, live payment enablement, deployment or external message to real users was performed. **Stopped after Phase B; awaiting review/approval before Phase C.**
