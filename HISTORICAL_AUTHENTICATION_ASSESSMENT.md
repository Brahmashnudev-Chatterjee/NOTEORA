# Historical authentication-material assessment — Phase E.2

Assessment date: 2026-11-13. Owner response: **Unknown — keep under review**. No deployment was contacted and no preserved credential was replayed, cracked, rotated or revoked.

| Export | Observed category | Count | Assessment |
| --- | --- | ---: | --- |
| `database/export/users.json` | bcrypt password hashes | 2 | Password validity and deployment relevance unknown. Hashes permit offline guessing if disclosed; do not publish them. |
| `database/export/users.json` | verification token or token-hash fields | 2 | Both records lack verification expiry. Both were unverified and marked active in the snapshot. Current API requires a matching hash and future expiry. This does not establish safety of older deployments. |
| `database/export/activitylogs.json` | network/session metadata fields | 1 | Personal/security metadata; not evidence of an active authentication session. |
| `database/export/usersessions.json` | network/session metadata fields | 2 in one record | Analytics session metadata; current authentication uses separate AuthSession records. |

No refresh/reset token, gateway key or provider credential was identified in the reviewed snapshot. This is a scoped field/content assessment, not proof that all historical secrets have been discovered. Two new MongoDB integration tests use synthetic records to verify missing-expiry/plaintext verification rejection and separation of analytics sessions from authentication sessions. Actual preserved tokens were never submitted to an API.

## Preservation and access

All 16 JSON exports were preserved byte-for-byte in a unique directory under `%LOCALAPPDATA%\Noteora\preserved-exports`, outside the repository and application build contexts. Each source/destination SHA-256 matched before the workspace file copy was removed. Protected ACLs grant access only to the current Windows user, SYSTEM and local Administrators. Original broad inherited Users/Authenticated Users permissions were not retained. Exact local archive location and per-file integrity/ACL evidence are in `docs/evidence/phase-e2/export-storage-verification.json`. That locator contains no credential values, but should still be treated as internal operational evidence. The preserved exports are not an application backup or a production recovery validation.

`scripts/secure-historical-exports.ps1` performs guarded copy, integrity verification, ACL restriction and removal of the verified workspace copies. Its execution did not alter a database or the preserved export contents. No sensitive export was uploaded to the disposable container VM.

## Git and release implications

HEAD `acee7c9da7c53b89bebb33e1803c7f87e2fbda83` and the index contain no export paths. The older commit `cb18b42a0200b608f9f2754a393baf42589232b3` still contains authentication material. In-memory `git archive` checks found zero known historical values in the current HEAD archive and four in the historical export archive. No such archive was persisted. Removing current tracking does not clean history, cached downloads, forks, clones or older release artifacts.

Fresh redacted Gitleaks history results contain two historical authentication matches and two evidence-checksum false positives. The working-directory scan contains only the two checksum false positives. No allowlist or suppression was introduced. Known historical values were also checked against actual application build outputs and the sanitized container context with zero matches; this does not attest to every external deployment/release/log.

## Required owner decisions

See `CREDENTIAL_ROTATION_CHECKLIST.md`. Unknown provenance remains a security gate. Review affected accounts and deployments privately, approve any necessary password/token/session actions, and decide whether coordinated repository-history cleanup is required. No claim is made that potentially exposed passwords have stopped working. No Git history rewrite or remote push was performed.
