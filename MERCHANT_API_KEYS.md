# Merchant API Keys

`POST /api/v1/merchant/api-keys` creates test or live environment credentials. The public key prefix identifies the environment. Only a SHA-256 hash of the key and secret is stored. The complete secret is returned once and never exposed by list endpoints.

Generating a new key deactivates the prior active key in that environment. Keys support expiry and explicit revocation. Verification is available at `POST /api/v1/credentials/verify`; no live payment behavior is implemented.
