# Container verification procedure — Phase E.2

Use disposable development infrastructure only. No production URL, provider credential or preserved account export is needed. Final executed results and residual findings are in `PHASE_E2_FINAL_SECURITY_GATE_REPORT.md` and `CONTAINER_VULNERABILITY_REGISTER.md`.

## Reproducible image inputs

Application Dockerfiles pin Node 22 Alpine and unprivileged Nginx by digest. Each API installs locked dependencies with npm 11.21.2, generates only its own Prisma client with auto-install disabled, compiles TypeScript, prunes development dependencies and copies only required outputs into a non-root runtime. The shared schema remains unchanged. Runtime OS upgrades and npm/Corepack removal are real build steps, not assumed vulnerability clearance. API and worker processes use the same respective runtime image; worker command/health settings remain in Compose.

Supporting image Dockerfiles are in `deployment/support`. MongoDB remains version 7 and PostgreSQL remains version 16. Their `gosu` 1.20 source is pinned by SHA-256 and rebuilt using Go 1.27.4 with CGO disabled for Linux/amd64. No compiler is copied into the runtime. Mongo's standalone `js-yaml` is patched within major version 3 to 3.15.2, verified against pinned npm SHA-512 integrity. Ubuntu/Alpine package updates run without a distribution-major upgrade. Redis keeps major version 7.

The upstream gosu 1.20 binary was inspected and still used Go 1.24.6. Installing that binary alone would not address its bundled standard-library advisories. The initial Windows filesystem-only Trivy candidate check did not recognize it as a language artifact; its zero findings are **not** used as evidence of safety. Final Docker image scans are the relevant evidence.

The Go toolchain archive used for this run was checked against the official download checksum. Go 1.27.4 is documented in the [official release history](https://go.dev/doc/devel/release#go1.27.4); gosu source comes from the [maintainer repository](https://github.com/tianon/gosu/tree/1.20). Do not silently change tool versions or checksums. Binary build metadata and exact hashes are in `docs/evidence/phase-e2/support-build-metadata.json`.

## Build and inspect on a Linux Docker engine

Install the reviewed Go toolchain outside the application repository. Set `GO_EXECUTABLE` if it is not on PATH. Prepare contexts outside the repository:

```sh
python scripts/prepare-e2-support-context.py --output /tmp/noteora-e2-support
docker build --platform linux/amd64 --progress=plain -t noteora-postgres:e2 /tmp/noteora-e2-support/postgres
docker build --platform linux/amd64 --progress=plain -t noteora-mongo:e2 /tmp/noteora-e2-support/mongo
docker build --platform linux/amd64 --progress=plain -t noteora-redis:e2 /tmp/noteora-e2-support/redis
docker build --progress=plain -f server/Dockerfile -t noteora-server:e2 .
docker build --progress=plain -f gateway-api/Dockerfile -t noteora-gateway:e2 .
docker build --progress=plain -f client/Dockerfile -t noteora-web:e2 .
trivy image --scanners vuln --format json --output server-scan.json noteora-server:e2
trivy image --scanners vuln --format json --output gateway-scan.json noteora-gateway:e2
trivy image --scanners vuln --format json --output web-scan.json noteora-web:e2
trivy image --scanners vuln --format json --output postgres-scan.json noteora-postgres:e2
trivy image --scanners vuln --format json --output mongo-scan.json noteora-mongo:e2
trivy image --scanners vuln --format json --output redis-scan.json noteora-redis:e2
```

Keep all severities visible, including UNKNOWN. For a severity gate, additionally run `trivy image --scanners vuln --exit-code 1 --severity HIGH,CRITICAL IMAGE`; a nonzero exit with findings is a blocked security gate, not an instruction to suppress advisories. Scan the exact built image ID, not a mutable tag that was never rebuilt.

For development Compose, set `NOTEORA_SUPPORT_CONTEXT` to the prepared directory and use both `docker-compose.yml` and `deployment/docker-compose.security.yml`. The original file's vendor-image defaults are retained; using it alone does **not** select the patched support images. No production Compose deployment is approved by this override. Generated support contexts/binaries must never be committed.

The verification run used a portable, disposable Linux VM because the Windows host had no container engine or installed WSL. It did not install a host service, enable Windows features or change production. Emulated builds/smoke checks do not establish production performance, load capacity, kernel hardening or infrastructure readiness.

## Safety and recovery limits

Use generated test credentials, a private Docker network and newly named test containers/databases. Do not log container environment dumps. Check UID dropping, application liveness, worker heartbeat, Redis/BullMQ connectivity and Nginx proxy behavior. Test provider-free Mongo/PostgreSQL fixtures and restore into a newly created disposable database. Preserve final scan JSON and exit codes. Stop only containers/services created by verification.

Fresh and repeated schema deployment must use `scripts/deploy-development-schema.mjs` as documented in `MIGRATION_BOOTSTRAP.md`; bare historical migration ordering remains intentionally rejected. Logical and synthetic custom-format restore checks are narrower than production/PITR recovery. TLS, private networking, key custody, production monitoring/retention and approved credential review remain infrastructure/owner responsibilities.
