# Gateway Security

Gateway protections include Helmet, CORS, JSON size limits, per-IP rate limiting, bcrypt owner passwords, JWT authentication, administrator bearer authorization, API-key and webhook hashes, AES-256-GCM webhook secrets, Zod validation, merchant-level isolation and audit logging.

Credential values are never logged. PostgreSQL ports are loopback-bound in Compose. Redis requires a password. Live payment processing is disabled. Production traffic and MongoDB remain unchanged.

Automated security coverage verifies unauthenticated merchant routes, unauthorized administrator routes, invalid registration, and invalid credential payload handling. Cross-merchant live integration coverage must be performed against the isolated development database before production use.
