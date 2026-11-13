# Repository and artifact verification — Phase E.2

Executed 2026-11-13 with no production access. Evidence is under `docs/evidence/phase-e2`.

| Boundary | Executed check | Result and limit |
| --- | --- | --- |
| Git index/current HEAD | Enumerated `database/export` paths and inspected current source archive in memory | No export paths; no known historical authentication values in current archive. Older history remains sensitive. |
| Historical Git archive | Inspected the affected commit's export archive in memory | Four known historical values remain. No archive was saved or uploaded. |
| Local exports | SHA-256 copy verification and protected ACL checks for 16 JSON files | Preserved unchanged outside workspace, restricted to current user/SYSTEM/Administrators. |
| Application build outputs | Exact in-memory matching of four historical token/hash values against `client/dist`, `server/dist`, `gateway-api/dist` | Zero matching output files. Not a universal secret-detection guarantee. |
| Verification logs/artifacts | Same exact-value check against E.2 evidence, plus redacted Gitleaks working-tree scan | Historical values are never reported; checksum false positives remain unsuppressed. |
| App context uploaded to disposable VM | Explicit source allowlist, exact-value check and SHA-256 manifest | No exports, private environment files, installed dependencies or generated outputs were transferred. |
| Docker ignore semantics | Real Docker `FROM scratch`/`COPY .` build with synthetic canaries, then exported filesystem inspection | Export JSON, root/nested `.env`, `.npmrc`, secret directories, AWS credentials, SSH key file, node_modules and evidence canaries excluded. `.env.example` and public source retained. |
| External releases/deployment logs | No production/hosting systems contacted | Not verified; owner must review older releases, clones, caches and actual deployment logs. |

The `.dockerignore` rules now also exclude nested secret directories, package-manager credentials, cloud credential folders and SSH private-key filename families. Existing export, environment, certificate/private-key, upload, Git, output and evidence exclusions remain. An allowlisted context is a second boundary, not a substitute for Docker's actual ignore rules.

`scripts/verify-e2-artifacts.py` reads preserved historical values only into memory and prints counts, never values. `repository-artifact-verification.json` records the selected context hash and actual output checks. Build-image and runtime checks are recorded separately in `PHASE_E2_FINAL_SECURITY_GATE_REPORT.md`; an output/context check alone does not certify every final image layer.

No Git history rewrite, force push, credential rotation, provider connection or production change was performed. Owner provenance is unknown. See `HISTORICAL_AUTHENTICATION_ASSESSMENT.md` and `CREDENTIAL_ROTATION_CHECKLIST.md`.
