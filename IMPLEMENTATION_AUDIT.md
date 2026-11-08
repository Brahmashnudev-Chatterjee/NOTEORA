# Noteora Implementation Audit

## Status evidence

| Area | Status | Evidence |
|---|---|---|
| Authentication and JWT RBAC | IMPLEMENTED BUT NOT TESTED | `server/src/auth.ts`, login/register/admin and role middleware in `server/src/routes.ts`. No refresh-token rotation yet. |
| Buyer/seller/admin accounts | IMPLEMENTED BUT NOT TESTED | Role field, dashboards, admin moderation/user/order APIs and login activity logging. |
| Marketplace search and browsing | COMPLETE AND VERIFIED at build level | Approved-material routes and React marketplace; database journey not run without MongoDB. |
| Cart and server-authoritative pricing | COMPLETE AND VERIFIED at build level | Cart is replaced by approved database materials and orders store server-calculated totals. |
| PDF private upload and moderation | IMPLEMENTED BUT NOT TESTED | Multer private storage, magic-byte validation, PENDING status and admin moderation route. Full content scanning is absent. |
| PDF download authorization | IMPLEMENTED BUT NOT TESTED | PAID purchaser and approved-material checks, plus 15-minute HMAC download token. |
| Seller ledger | PARTIALLY IMPLEMENTED | Idempotent ledger insert keyed by seller/order exists, but settlement payout execution and full refund provider reconciliation remain external work. |
| Financial calculations | IMPLEMENTED BUT NOT TESTED | Configurable financial service exists. GST rates require CA verification; gateway fees remain configuration-dependent. |
| Reviews | IMPLEMENTED BUT NOT TESTED | Review creation requires a PAID order containing the material. |
| Admin reporting/CSV | IMPLEMENTED BUT NOT TESTED | Date-range report and CSV export route; dashboard counts are database-backed. |
| Payment gateway client | PARTIALLY IMPLEMENTED | Headers/order/status endpoints are implemented, but actual Laravel repository and credentials are unavailable. |
| Webhook signature processing | IMPLEMENTED BUT NOT TESTED | Raw-body HMAC, five-minute tolerance, environment, event ID and sequence handling exist. A real Laravel payload must still be verified. |
| Live/Sandbox isolation | IMPLEMENTED BUT NOT TESTED | Environment selects separate API credentials, webhook secret and order environment. |
| Email verification | PARTIALLY IMPLEMENTED | Verified flag exists and `/auth/verify` is protected but sends no email token. |
| Refresh tokens/CSRF | NOT IMPLEMENTED | JWT local-storage bearer flow has no rotation or revocation. Production should prefer secure cookies plus CSRF. |
| Password reset | NOT IMPLEMENTED | User model/API has no reset token workflow. |
| Object storage/malware scan | BLOCKED BY MISSING DEPENDENCY | Disk/private upload exists; managed storage, malware scanning and copyright workflow credentials/tools are unavailable. |
| Gateway refunds | BLOCKED BY MISSING DEPENDENCY | Ledger and local status can be adjusted, but a real gateway refund request needs the Laravel refund contract. |
| Real MongoDB or payment journeys | BLOCKED BY MISSING DEPENDENCY | No supplied running MongoDB instance, gateway repository, credentials or webhook signing secrets. |

## Automated verification

Run `npm run build` and `npm --prefix server test`. Unit coverage currently includes financial boundaries and webhook raw-body/HMAC behavior. Full integration and browser journeys require MongoDB and Playwright tooling.

## External blockers

- Actual Laravel gateway repository and source documentation not supplied.
- Sandbox/live API credentials and webhook secrets not supplied.
- Running MongoDB Atlas/local instance not supplied.
- SMTP/provider credentials not supplied.
- Private object storage and malware-scanning credentials/tools not supplied.
- CA approval for GST, commission and gateway-fee accounting assumptions.
