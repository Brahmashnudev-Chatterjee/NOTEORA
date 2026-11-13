# Webhook integration and development delivery

Phase E implements management and delivery infrastructure for **gateway.test only**. It does not generate payment-success events. A test contains `event: gateway.test`, `test: true`, `environment: SANDBOX` and an explicit statement that no payment exists. Live endpoint configurations may be provisioned, but live events/delivery are disabled.

Owner/admin/developer can PUT `/api/v1/merchant/webhooks` with environment, URL, active and eventSubscriptions (either `["gateway.test"]` or `[]`); optional id edits an owned endpoint. Saving rotates the signing secret. Only the creation/configuration response returns plaintext once. The database stores a SHA-256 hash plus an AES-256-GCM encrypted envelope (IV12, authentication tag16, ciphertext), compatible with earlier stored envelopes. Regular metadata/admin listings exclude both. Encryption-key rotation/re-encryption requires a separate operational procedure; replacing the key without re-encryption breaks existing delivery.

URLs must be HTTPS, without embedded credentials/fragments. Registration and every delivery check DNS/address safety. Private, loopback, mapped, link-local and metadata addresses are rejected by default. Each outgoing request pins the checked address while retaining the original hostname/TLS verification; redirects are not followed. For an isolated local receiver, set an exact `GATEWAY_WEBHOOK_DEV_ORIGINS` origin in non-production, such as `http://127.0.0.1:6789`. This exception is ignored in production. Egress firewall/DNS controls are still recommended for deployment.

POST `/api/v1/merchant/webhooks/:id/test` with an 8-100 character alphanumeric/underscore/hyphen idempotencyKey. The active approved sandbox endpoint must subscribe to gateway.test. Merchant, endpoint and key scope a deterministic event ID. Concurrent/repeated requests create only one event/delivery/outbox record. Returning202 means queued, not delivered. Reusing the key after terminal failure returns that same event; a deliberate new test needs a new key.

## Receiver verification

Each request includes `X-Noteora-Event-Id`, `X-Noteora-Timestamp` (Unix seconds) and `X-Noteora-Signature` (hex HMAC-SHA256). Signature input is timestamp + `.` + the **exact raw JSON body**. Verify before JSON transformations, reject stale timestamps (five-minute tolerance), compare digests in constant time, and durably deduplicate event IDs. `gateway-api/src/security.ts` exports a verifier and has executed signature/tampering/tolerance tests. A valid test signature is not evidence of any transaction.

Persist acceptance before returning2xx. Non2xx, timeout and network/validation errors retry. Response bodies are not persisted or logged; status codes and sanitized outcomes are recorded. Request timeout is10 seconds; redirects are failures.

## Worker and durability

`npm.cmd --prefix gateway-api run worker` starts the opt-in BullMQ/Redis worker. PostgreSQL is the durable delivery/inbox source: atomic event/delivery/outbox insertion precedes scheduling, so Redis loss or API-to-queue interruption does not lose queued tests. The dispatcher scans due records, schedules job IDs derived from delivery/attempt, and uses BullMQ exponential retries. PostgreSQL leases and conditional attempt updates prevent concurrent workers from sending the same current attempt.

There are at most five attempted sends, with delays1,2,4,8 seconds between normal failures. Terminal states are DELIVERED, FAILED and CANCELLED. A one-minute expired lease records UNKNOWN_AFTER_WORKER_INTERRUPTION before recovery; a crash can occur after the receiver accepted but before the sender persisted success. **Delivery is at least once, not exactly once.** Receiver event-ID deduplication is mandatory. A crash at the attempt limit ends as FAILED with unknown prior outcome, not invented success.

Disabled/unsubscribed endpoints and unapproved merchants cancel queued delivery; each attempt rechecks status. A request already in flight cannot be recalled. Pending tests use current endpoint configuration and secret at claim time, so rotate receiver configuration consistently. GET `/merchant/webhook-deliveries` includes the latest100 owned deliveries and all their attempt records; merchant activity records outcomes. No public retry-to-success or payment override exists.

Tests use real local HTTP receivers, isolated PostgreSQL and Redis. Full outbound payment-event producers, provider integrations, retention policies, operational alerts/dead-letter tooling and live delivery authorisation remain outside Phase E.
