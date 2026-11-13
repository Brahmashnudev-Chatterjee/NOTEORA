# Credential review and rotation checklist — Phase E.2

Owner provenance answer: **Unknown — keep under review**. None of the following account changes is approved or executed by this phase.

- [ ] Privately identify the two exported accounts and their source deployment, environment, snapshot date and current account status. Do not paste identities or hashes into public issues.
- [ ] Determine whether the historical verification fields were plaintext tokens or hashes in the relevant deployed code, and whether that deployment enforced expiry and single use. Current-code rejection does not attest to an older deployment.
- [ ] If relevant, approve invalidation of affected verification/reset material and replacement through the legitimate email workflow. Never mark an account verified as remediation.
- [ ] If the hashes came from real accounts or provenance cannot be established, decide and approve forced password resets and revocation of affected refresh/authentication sessions. Check password reuse risk through an appropriate owner-led process; do not attempt offline guessing.
- [ ] Review historical session/network metadata for privacy and retention obligations. An analytics record is not itself a valid current AuthSession.
- [ ] Review whether other exports/releases, CI artifacts, public forks or downloaded archives contain the same data. Restrict access while investigating.
- [ ] Approve any coordinated `git filter-repo` cleanup separately: preserve an access-controlled backup, enumerate affected refs/tags, prepare a dry-run in a disposable clone, review the result, coordinate collaborator recloning and hosting-provider cache/fork cleanup, then obtain approval for any force push. History rewriting alone does not revoke credentials.
- [ ] Record the approved action, responsible owner, target environment, execution time and verification result without recording replacement secrets.
- [ ] Keep the preserved archive access-controlled; approve its eventual retention/deletion separately.

No provider/API credential was identified in the reviewed marketplace exports. Do not rotate unrelated production credentials based solely on this document. Ephemeral VM/test credentials are separate disposable verification fixtures, never actual customer credentials.
