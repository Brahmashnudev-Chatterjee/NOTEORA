# Gateway management API - Phase E

Base: `/api/v1` on the separate gateway service (default port5100). Marketplace MongoDB authority is unchanged. All payment, UPI, refund, settlement and payout execution remains unavailable.

## Authentication

Merchant access uses purpose-bound 15-minute bearer tokens and a rotating HttpOnly refresh cookie. Cookie requests require an allowed `Origin` and `X-Noteora-CSRF: 1`. Configure `GATEWAY_CLIENT_URL` to exact frontend origins. Tokens, invitations and one-time secrets must never be placed in URLs, logs or persistent browser storage. The UI stores merchant access separately from marketplace administrator tokens in sessionStorage; refresh cookies are HttpOnly. Invitation links use a fragment, not a server-visible query string.

Administrators use a marketplace ADMIN/SUPER_ADMIN bearer session. Gateway `MARKETPLACE_AUTH_URL` points to the trusted marketplace service; every administrator request is introspected there. A merchant JWT or shared administrator password is insufficient. Use HTTPS between deployed services. Introspection failure fails closed.

| Method and path | Permission / behavior |
|---|---|
| POST `/merchants/register` | Public, rate limited; creates pending merchant and hashed owner password atomically |
| POST `/auth/login`, `/auth/refresh`, `/auth/logout` | Merchant session lifecycle; origin/CSRF protected |
| GET `/merchant/me` | Merchant profile, safe team metadata and current role |
| PATCH `/merchant/me` | Owner/admin; validated business/contact fields; business identity changes return approved merchant to UNDER_REVIEW |
| GET `/merchant/team` | Scoped safe members and invitation metadata |
| POST `/merchant/team/invitations` | Owner/admin; name/email/role; returns single-use token once |
| POST `/team/accept` | Public, rate limited; token and new password; invitation supplies identity/role/merchant |
| POST `/merchant/team/invitations/:id/revoke` | Owner/admin with target-role restrictions |
| PATCH `/merchant/team/:id` | Owner/admin with target-role restrictions; role or active:false; revokes member sessions |
| GET/POST `/merchant/api-keys` | Metadata listing / owner-admin-developer creation and environment rotation |
| POST `/merchant/api-keys/:id/revoke` | Owner/admin; scoped revocation |
| GET/PUT `/merchant/webhooks` | Safe listing / owner-admin-developer configuration; secret rotates on save |
| POST `/merchant/webhooks/:id/test` | Owner/admin/developer; active approved sandbox endpoint; idempotencyKey required |
| GET `/merchant/webhook-deliveries` | Scoped last100 deliveries and per-attempt outcomes |
| GET `/merchant/activity` | Scoped last100 immutable-through-API audit entries |
| GET `/integration/context` | SANDBOX API-key middleware; returns only authenticated merchant context and paymentsEnabled:false |
| POST `/credentials/verify` | Compatibility credential check, same environment/status enforcement; no payment capability |
| GET `/admin/overview` | Marketplace administrator, real status counts including disabled |
| GET `/admin/merchants` | Administrator; q, status, page; 25 per page |
| GET `/admin/merchants/:id` | Administrator; profile, safe team/key/webhook metadata and last100 audit entries |
| PATCH `/admin/merchants/:id/status` | Administrator; status, expectedStatus and nonempty reason; transactional audit and session revocation |

Validation errors400, missing credentials401, permission/status denial403, scoped missing target404, stale review/ownership/unique conflict409. Listing endpoints never expose password hashes, key hashes, encrypted secrets or invitation tokens. Secret creation responses use Cache-Control:no-store.

Roles are `MERCHANT_OWNER`, `MERCHANT_ADMIN`, `MERCHANT_DEVELOPER`, `MERCHANT_VIEWER`. Only owners appoint/manage owners or admins; admins manage developer/viewer roles. The last active owner cannot be demoted/revoked. Developers configure keys/webhooks but cannot manage teams or profiles. Viewers read only. Every target is scoped to the authenticated merchant. Merchant-level row locks serialize privileged mutations and concurrent key rotation.

Status PENDING/UNDER_REVIEW permits console onboarding but not key provisioning/test delivery. APPROVED permits development infrastructure. REJECTED/SUSPENDED/DISABLED blocks session access/login and API-key use; sessions are revoked on status change. Reactivation requires a new login. Approval is an internal administrative decision, not a regulatory authorisation.

Request examples and signing details: [credentials](API_KEYS.md), [webhooks](WEBHOOKS.md), [onboarding](ONBOARDING.md). No endpoint accepts client claims of payment success.
