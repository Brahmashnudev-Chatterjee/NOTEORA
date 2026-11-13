# Deployment security checklist - Phase E.1

Updated2026-11-13. This is development verification and a production gate checklist, **not authorisation to deploy**. MongoDB remains marketplace authority. No live provider, UPI, settlement or payout is enabled.

For the retained Prisma6 native PostgreSQL connector, production URLs require `sslmode=require&sslaccept=strict`, plus a mounted CA certificate where the system trust store is insufficient. Prisma6 does not support every libpq SSL option; see its [version6 connector documentation](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql#configuring-an-ssl-connection). MongoDB validation accepts replica-set seed lists/SRV and rejects explicit TLS/certificate-validation bypasses. Real certificate handshakes remain infrastructure verification.

| Control | Implemented / verified | Production infrastructure still required |
|---|---|---|
| Secrets and environment | Shared startup validation rejects weak/placeholder production signing/encryption keys, missing explicit origins, plaintext DB/admin transports and unbounded proxy counts. Environment samples identify development values. Private exports untracked/excluded from build context. | Secret manager, inventory, access/rotation policy, [historical export review](SECRET_FINDINGS.md); never supply production secrets to image builds or test jobs. |
| CORS | Exact origins only; wildcard/path/credentials rejected. Production requires HTTPS origins; untrusted requests fail403. Server-to-server requests without Origin still require endpoint authentication. Unit/API tests executed. | Configure actual frontend origins; avoid trusting user-controlled subdomains. |
| HTTPS/proxies | Production HTTP rejected except minimal liveness. Only bounded explicit proxy hops trusted; enforcement tested. Secure/HttpOnly/SameSite=Strict refresh cookies retained. | Actual certificates, TLS ingress/service routes, firewall preventing direct app access/header spoofing, certificate renewal. HTTPS validation is not a deployed TLS handshake test. |
| Sessions/roles | Existing verification/reset/refresh/revocation/status/merchant-admin isolation regression suites pass. Team/API-key permissions and restricted DB roles tested. | Identity operations, incident response and review of legacy accounts. |
| Rate/size limits | Existing authentication/registration/reset limits retained; sensitive gateway routes have production60/min limit. JSON/raw body1MB limits and safe parsing errors tested; upload limits retained. Frontend proxy32MB cap. | Distributed rate-limit store and ingress limits for multi-instance deployments; current per-process limiter is not global. |
| Headers/errors/logs | Helmet/security headers, no-store gateway/session responses, generic500/parser errors and shared nested credential redaction. Prisma raw error logging disabled; worker failures do not log job data/raw errors. Tests cover sensitive-body reflection/redaction. Nginx access logging disabled to avoid URL credentials. | Central sanitized observability/alerts/retention and an end-to-end ingress log review. Do not enable raw request/response logging. |
| PostgreSQL roles | Exact gateway grants file executed in disposable DB. API cannot read payment/marketplace tables or create schema objects; worker cannot read users/credentials. Actual auth/merchant/queue/browser suites use restricted runtime identities. Audit write/delete protection remains tested. | Provision independent passwords via secret manager; apply reviewed grants after migration with separate owner/migrator. Do not give runtime roles DDL/admin ownership. Existing legacy role provisioning needs a reviewed rollout. |
| MongoDB | Marketplace source of truth unchanged; production URI requires authenticated TLS. Transactional financial/upload behavior and isolation regressions pass on temporary replica sets. | Real least-privilege application/backup users, verified replica-set topology, TLS certificates, backups/restore and index rollout. Do not run financial writes against standalone MongoDB. |
| Redis/queues | REDIS_URL now honored by marketplace queue workers, encoded credentials decoded, rediss support retained. Gateway queue uses independent URL/database. Real password-protected Redis/BullMQ retries pass. Redis config avoids password command-line args in Compose; ports bind loopback. | Redis TLS/ACLs, network isolation, persistence/availability policy; isolated queues/instances for environments. No public unauthenticated Redis. |
| Containers | Pinned scanned bases, locked npm ci, production builds, pruned dev packages, non-root node/nginx/Redis, no-new-privileges/capability drops, private build-context exclusions, corrected worker entrypoint. Available OS refresh/tool removal prepared. Portable Compose config validation executed. | **Docker builds, runtime permissions and rebuilt-image scans not executed here.** Three critical/83 high base-image occurrences remain open. Postgres/Mongo upstream entrypoint privilege/volume initialization must be validated; no unsupported user override was applied. |
| Health/shutdown | Minimal API liveness, retained dependency readiness, worker heartbeat files, bounded shutdown handlers. Real HTTP drain and heartbeat cleanup tests pass. Compose specifies init and20-second grace periods. | Real process-signal/container shutdown tests, queue health alerts and mounted-volume ownership checks. Worker heartbeat creation is not a complete operational monitoring system. |
| Migration safety | Explicit dev-only deployment command validates endpoint/name/history/checksum, serializes bootstrap and refuses nonempty/untracked/failed history. Fresh/repeat/refusal/reproduction checks executed. | [Migration procedure](MIGRATION_BOOTSTRAP.md), reviewed existing-database plan, production backup/restore readiness. No production run is approved. |
| Backups/recovery |16 gateway application tables matched after logical fixture restore to a second fresh DB. Binary backup helper now requires explicit isolated source and creates a unique restore DB without deleting an existing DB. | Full pg_dump/pg_restore helper **not executed** without Docker; PITR/WAL, roles/grants, encrypted backups, restore RTO/RPO and encryption-key recovery remain unverified. Preserve private backups outside Git. |
| Dependency gate | All four npm full/omit-dev audits0; Trivy lockfiles0. Node/Prisma/test upgrades and override tested. | Rescan continuously; fix/validate container findings and historical exposure before production approval. |

## Development commands and defaults

Use Node22 (or supported Node20.19+) and npm11.21.2. npm10 failed while resolving the required peer/override upgrade; it is not the verified upgrade resolver. Do not use `npm audit fix --force` or ignore findings.

```powershell
npm install --global npm@11.21.2
npm ci --ignore-scripts
npm --prefix server ci --ignore-scripts
npm --prefix gateway-api ci --ignore-scripts
npm --prefix client ci
npm --prefix server run prisma:generate
npm --prefix server test
npm --prefix gateway-api test
npm --prefix server run build
npm --prefix client run build
npm --prefix gateway-api run build
```

PowerShell execution policy may require `npm.cmd` instead of npm. The actual verified tool was isolated under the temporary tools directory; global installation above is optional local setup, not a production operation.

The main Compose file is explicitly **development only**, with HTTP local origins/cookies and loopback application/database ports. It is not a production TLS configuration. Its standalone default Mongo service does not satisfy Phase D transactional writes: use the separately approved replica-set development setup and explicitly configure MONGO_URI/network routing. Compose role provisioning and post-migration grants are required before gateway use; existing PostgreSQL volumes do not rerun init scripts. Do not recreate or delete volumes to force a role update.

Root `database/security/setup-roles.sql` now reads passwords from environment via psql rather than command-line arguments, uses the connected DB name and stops giving marketplace roles blanket gateway table rights. These init-script/container paths were reviewed/prepared but are not Docker-runtime-certified. Apply dedicated grants only after all tables exist. Localhost development transport must never be relabelled production to bypass the startup checks.

## Container gate commands (not executed here)

After a container engine is available, use development-only values and the pinned bases:

```powershell
docker compose config --quiet
docker build -f server/Dockerfile -t noteora-api:e1 .
docker build -f gateway-api/Dockerfile -t noteora-gateway:e1 .
docker build -f client/Dockerfile -t noteora-web:e1 .
trivy image --scanners vuln --exit-code 1 --severity HIGH,CRITICAL noteora-api:e1
trivy image --scanners vuln --exit-code 1 --severity HIGH,CRITICAL noteora-gateway:e1
trivy image --scanners vuln --exit-code 1 --severity HIGH,CRITICAL noteora-web:e1
```

Do not treat Node npm/Corepack removal or `apk upgrade` as a passed rescan. Obtain patched Mongo7/PostgreSQL16 utility bundles and rescan those too; do not perform an unreviewed database-major upgrade. Production image approval remains blocked by the [advisory register](DEPENDENCY_ADVISORY_REGISTER.md).

The binary restore verifier accepts `-SourceDatabase <name>_test` or `<name>_development` only and creates its own uniquely named destination. It never drops/reuses an existing restore DB. Its encrypted storage/secret handling and real Docker execution still require verification. The older representative marketplace migration/cutover tools are not the approved gateway deployment path and are not authorised for production by this phase.
