# Webhook Configuration

`PUT /api/v1/merchant/webhooks` creates or updates an environment-specific endpoint. Signing secrets are generated with cryptographic randomness, encrypted at rest using AES-256-GCM, and returned only once. List endpoints return endpoint metadata only.

Configurations support URL, active state and event subscriptions. Delivery and real payment event notification are intentionally not claimed as operational in Phase 5C.
