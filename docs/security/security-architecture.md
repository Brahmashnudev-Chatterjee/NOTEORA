# Security Architecture

## Existing controls retained

- Helmet HTTP security middleware.
- Express rate limiting.
- CORS allow-list with credentials.
- bcrypt password hashing.
- JWT bearer authentication and role middleware.
- private PDF disk storage with protected download routes.
- raw-body webhook handling.
- HMAC-SHA256 timestamped webhook verification.
- five-minute webhook timestamp tolerance.
- unique webhook event ID persistence and sequence fields.
- server-authoritative cart totals.

## Phase 5B requirements

- Replace development JWT fallback secrets with mandatory production secrets.
- Move refresh sessions to PostgreSQL and rotate refresh tokens atomically.
- Prefer secure HTTP-only cookies with SameSite and CSRF protection where browser credentials are used.
- Continue Bearer support only for explicitly non-browser API clients.
- Add session revocation and password-reset revocation.
- Encrypt provider credentials and merchant secrets using an application-managed KMS/key service.
- Store API secrets hashed and return a secret once at creation.
- Add merchant API timestamp validation, replay protection and idempotency keys.
- Use constant-time HMAC verification and separate Live/Sandbox webhook secrets.
- Protect gateway administration with MFA and independent roles.
- Prevent marketplace services from direct gateway financial writes through an API-only boundary.

## Gateway isolation

- Marketplace and gateway modules use different PostgreSQL schemas.
- Separate credentials, environment values and transaction partitions prevent Sandbox records entering Live reports.
- Merchant API credentials are scoped to one merchant and environment.
- Payment account selection records every account choice and reason.
- Signed event payloads and sequence numbers prevent old events overwriting newer states.

## Credential storage

No credentials are committed. `.env` files remain excluded and development Compose values are explicitly development-only placeholders.

Required secrets for later production configuration include database credentials, JWT signing material, Redis/TLS credentials, gateway merchant secrets, provider credentials and private object-storage credentials.
