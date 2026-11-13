# Merchant onboarding and development deployment

1. Open `/gateway/merchant`, choose Register merchant, and submit business/contact details with a password of at least12 characters (maximum72 UTF-8 bytes). Registration creates one owner, hashes its password and records an audit event. No payment account or fund transfer is created.
2. Sign in to review PENDING status and edit profile. PENDING and UNDER_REVIEW cannot provision keys. The separate marketplace administrator opens `/gateway/admin`, searches applications, opens a review and supplies the target status and recorded reason. Backend authorization and expectedStatus protect every review.
3. Once APPROVED, create sandbox credentials, configure a webhook and invite members. Securely share the one-time invitation out of band; invitation email delivery is not implemented. The recipient accepts within48 hours, chooses their own password, and then signs in with the invited email. Tokens are hashed, single-use and revocable. Reissuing an invitation revokes older unused invitations for that merchant/email.
4. Business name/type/contact-email/address changes return approved merchants to UNDER_REVIEW and disable credential access until reapproval. Contact-email edits do not silently change a user's login email. Profile addresses are supported by the API; the current UI edits primary business/contact fields.

Rejection records a reason; suspended/disabled/rejected merchants cannot log in or use keys. An administrator can reactivate after review; all prior sessions remain revoked. Team changes, key operations, configuration and delivery outcomes appear in merchant/admin activity. No audit-edit/delete API is exposed. Database administrators still require appropriate operational access controls; a SQL trigger blocks ordinary history update/delete, with only the existing merchant-FK detach exception; superusers can still bypass triggers, so this is not a tamper-proof external archive.

## Configuration

- `DATABASE_URL`: gateway PostgreSQL connection, with gateway schema.
- `GATEWAY_JWT_SECRET`: independent strong secret, at least32 characters.
- `GATEWAY_WEBHOOK_ENCRYPTION_KEY`: strong independent encryption material; keep outside source control and preserve securely for recovery. Existing AES-GCM envelope layout is retained.
- `GATEWAY_CLIENT_URL`: comma-separated exact frontend origins.
- `MARKETPLACE_AUTH_URL`: trusted marketplace base URL for live administrator introspection.
- `VITE_GATEWAY_API_URL`: frontend gateway base including `/api/v1`.
- `GATEWAY_REDIS_URL`: dedicated Redis connection for the opt-in BullMQ worker.
- `GATEWAY_WEBHOOK_DEV_ORIGINS`: optional exact local receiver origins in non-production only. Never use this to weaken production URL rules.

Start API with `npm.cmd --prefix gateway-api run dev`, worker with `npm.cmd --prefix gateway-api run worker`, and the existing frontend normally. The worker does not start implicitly with the API. Use separate development credentials, database and Redis namespace/instance; never point verification at production.

## Migration and verification

Phase E adds DISABLED to the gateway merchant enum, MerchantInvitation, WebhookAttempt and WebhookDelivery.leaseUntil. Existing marketplace tables/data are untouched. Migration: `database/prisma/migrations/20261113_phase_e_merchant_management/migration.sql`.

**Historical migration ordering needs care:** bare `prisma migrate deploy` on an empty database attempts the older `20261108_phase5c` before `20261108175257_phase5b`. Historical names were not changed because existing migration histories must be preserved. The isolated verifier guards that the new database is empty, applies the exact baseline SQL and records it with Prisma migrate resolve, then runs migrate deploy twice. It never marks an unapplied baseline as applied. Do not reuse this bootstrap on an existing database without a separately reviewed migration plan.

```powershell
npm.cmd --prefix gateway-api run prisma:generate
# Install the disposable PostgreSQL harness if absent:
npm.cmd install --prefix "$env:TEMP\noteora-phase-c-pg" embedded-postgres@16.15.0-beta.19
# Point to a portable Redis server executable (or redis-server on Linux):
$env:NOTEORA_REDIS_BINARY='absolute-path-to-redis-server'
node scripts/verify-phase-e-postgres.mjs
# Include real browser journeys:
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:RUN_GATEWAY_BROWSER='1'
node scripts/verify-phase-e-postgres.mjs
Remove-Item Env:RUN_GATEWAY_BROWSER
```

The runner creates two fresh loopback PostgreSQL databases and a password-protected temporary Redis on random ports. It checks repeat deployment and all gateway-table logical backup/restore equality, then stops the services. The logical backup contains synthetic fixture data, lives only in a temporary directory and is not a production backup solution. Full PostgreSQL binary backup/PITR, encrypted offsite storage, disaster recovery and production role/index rollout remain operational requirements. Docker and a production deployment were not exercised.
