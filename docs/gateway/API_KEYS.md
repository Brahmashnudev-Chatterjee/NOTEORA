# API key lifecycle

Only APPROVED merchants can generate credentials. Owner/admin/developer can create and rotate; owner/admin can revoke. Metadata is readable by merchant members and marketplace administrators without secret exposure.

POST `/api/v1/merchant/api-keys` with `{ "environment": "SANDBOX" }` (or LIVE) and optional future ISO `expiresAt`. The response returns id, apiKey and apiSecret **once**. Keys and secrets each contain32 cryptographically random bytes; the key has `nk_test_` or `nk_live_` prefix. Both are stored only as SHA-256 hashes; high entropy makes password-style hashing unnecessary. No secret retrieval endpoint exists.

Generation atomically revokes existing active keys in the same environment, stamps revokedAt and records revocation/creation events. Concurrent rotation is serialized by the merchant lock. Rotating sandbox does not rotate live. Expired/revoked keys fail immediately. An administrator suspending a merchant blocks all its keys without needing to expose them. Reactivation does not undo explicit key revocation.

Use credentials server-to-server only:

```http
GET /api/v1/integration/context
X-API-Key: <one-time sandbox key>
X-API-Secret: <one-time sandbox secret>
X-Noteora-Environment: SANDBOX
```

The middleware validates hashes, expiry, active status, exact environment and current merchant approval, then scopes the returned context to that merchant. It exposes no arbitrary merchant selector. Invalid credentials return401; unavailable merchant status/live resource access returns403. The compatibility `/credentials/verify` route applies the same checks.

**LIVE keys are provisioning metadata only.** All live resource access is denied regardless of key validity. Neither environment has a payment-processing endpoint in Phase E. Never ship keys to browser applications, put them in URLs, log request headers/bodies, or treat key generation as payment-provider authorisation. Future resources must explicitly adopt this middleware and preserve these restrictions until separately approved.
