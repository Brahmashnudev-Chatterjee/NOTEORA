# Dependency advisory register - Phase E.1

Audit date: 2026-11-13. [Complete advisory register CSV](DEPENDENCY_ADVISORY_REGISTER.csv) contains331 package/advisory relationships, versions/ranges, severities, identifiers, direct/transitive classification, available fixes, affected components, recommendations, evidence and remaining risk. Repeated dependency chains/image binaries are occurrences, not independent exploitable vulnerabilities.

## Application packages

| Tree | Before npm audit: critical/high/moderate | After full audit | After omit-dev audit |
|---|---|---|---|
| Root Prisma/tooling | 0/4/0 | 0 | 0 |
| Marketplace backend + workers | 2/4/1 | 0 | 0 |
| Marketplace/gateway React frontend | 0/0/0 | 0 | 0 |
| Gateway API + webhook worker | 2/3/1 | 0 | 0 |

The gateway frontend uses the existing client package/lockfile; it is not a separate dependency tree. Both worker families use their respective API packages. No audit configuration, severity threshold, ignore list or advisory was suppressed. A separate Trivy0.76.2 lockfile scan finds0 vulnerabilities across all four lockfiles. Raw before/after/full/runtime audit JSON and installed-before version records are in `docs/evidence/phase-e1/`.

17 advisory package nodes across three affected trees reduce to six unique underlying advisories. The CSV distinguishes advisory severity from aggregated package-node severity, available patched versions from implemented replacements, and npm's propagated package ranges from underlying vulnerable packages/ranges; propagated parents are not separate CVEs.

| Underlying advisory | Prior package/version | Implemented remediation |
|---|---|---|
| [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [GHSA-85c8-ppgw-ccpr](https://github.com/tinylibs/tinypool/security/advisories/GHSA-85c8-ppgw-ccpr) | tinypool1.1.1 via Vitest3.2.7 | Vitest4.1.12 removes tinypool from these trees. Registry audit assigns critical; maintainer severity may differ. Conservative registry severity retained. |
| [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [GHSA-qxg6-89mg-rqv8](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8) | Vitest/@vitest/mocker3.2.7 | Pin4.1.12, the patched mocker version for both findings. No patched3.x release was available. Vite stays7.3.7. Necessary test-tool major upgrade; application architecture unchanged. |
| [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) | deepmerge-ts7.1.5 via @prisma/config | Scoped @prisma/config override installs8.0.2. Prisma stays6.19.3. The [upstream8 release](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0) changes Map/deepmergeInto behavior/types; this application has no such config usage. CJS/ESM support, real configuration loading, generation, schema validation, migrations and integration tests passed. This is an actual package replacement, not an audit override. |
| [GHSA-38f7-945m-qr2g](https://github.com/advisories/GHSA-38f7-945m-qr2g) | effect3.18.4 in root/server Prisma config | Prisma/@prisma/client6.19.3 patch alignment brings effect3.21.0. No Prisma7/8 upgrade. |

Vitest/mocker/tinypool affected test execution/dev mock serving, not application HTTP routes; production builds exclude tests and development packages are pruned. Prisma config/Effect paths are tooling/configuration dependencies, not an application RPC feature. They were remediated rather than dismissed as non-exploitable.

npm10 hit an Arborist `edgesOut` resolver failure while changing the peer/override graph. Isolated npm11.21.2 resolved it; packageManager/CI/build tooling now specify that version. Initial tests under the old installation are not post-remediation evidence. Final logs explicitly show Vitest4.1.12. Clean lockfile-based installations are recorded separately.

## Container/base-image findings remain open

Remote Linux/amd64 registry-image scans were actually executed with Trivy0.76.2; Docker was not required to inspect these base images. Exact image digests and full package paths/fixes are retained in raw image JSON and the CSV. No built application image was scanned because a container engine is unavailable.

| Scanned image | Critical | High | Medium | Low | Unknown |
|---|---:|---:|---:|---:|---:|
| node:22-alpine | 0 | 10 | 13 | 1 | 0 |
| postgres:16-alpine | 1 | 25 | 31 | 3 | 2 |
| redis:7-alpine | 0 | 0 | 1 | 0 | 0 |
| mongo:7 | 1 | 36 | 78 | 19 | 18 |
| nginxinc/nginx-unprivileged:stable-alpine | 1 | 12 | 4 | 44 | 0 |

300 image package/advisory occurrences: **3 critical,83 high,127 medium,67 low,20 unknown**. These are preserved findings, not production acceptance. A clean npm audit does not clear them.

Critical occurrences include CVE-2025-68121 in Go stdlib bundled into `usr/local/bin/gosu` in Mongo/PostgreSQL, and CVE-2026-111497 in nginx image brotli-libs. Other bundled Go tools, mongosh YAML dependencies, global Node npm/Corepack and OS packages are enumerated individually in the CSV.

Node runtime Dockerfiles remove unused global npm/Corepack and prepare OS updates; the web runtime prepares available Alpine updates. These are **pending built-image verification**, not resolved scanner results. Builder dependency tooling uses the verified npm version. Base images are pinned to the inspected digests so the evidence is reproducible; pinning alone does not remediate a vulnerability.

Compiled Go utilities and mongosh bundles cannot safely be fixed by the application's npm overrides. A vendor image rebuilt with patched embedded dependencies, or a separately validated custom build, is needed. Changing Mongo/PostgreSQL major versions without data/runtime validation would violate the approved scope. There is no container engine/WSL here to validate such a replacement. Preserve their open severity; do not infer unreachability just because a utility often runs locally.

Compensating deployment controls include loopback/private network exposure, separate least-privilege identities, authenticated TLS requirements, restricted administrative files/commands, non-root application containers and no-new-privileges. These reduce exposure but do not establish that every vulnerable binary path is unreachable. Production deployment remains blocked pending patched images, rebuilt-image scans and runtime validation. Exact commands are in [deployment checklist](DEPLOYMENT_SECURITY_CHECKLIST.md).

Historical secret/export findings are tracked separately in [SECRET_FINDINGS.md](SECRET_FINDINGS.md); they are not npm advisories and were not hidden from this audit.
