# PostgreSQL Testing — Phase 5B.1

## Live integration suite

Run:

```powershell
npm run test:postgres
```

Actual result: 1 test file passed, 5/5 tests passed in 2.08 seconds.

Coverage includes live connectivity, duplicate email constraints, user relationships, material/category ownership, order/item relationships, ledger uniqueness and consistency, transaction rollback, internal-order uniqueness, concurrent updates, and cleanup.

The suite uses `TEST_DATABASE_URL` or the configured development URL and creates uniquely prefixed records. Cleanup runs after tests. A named order with duplicate client IDs was not used as the uniqueness fixture.

## Additional commands

```powershell
npm run prisma:validate
npm run prisma:generate
npm run postgres:verify
```

Docker health:

```powershell
docker compose ps
docker compose exec postgres pg_isready -U noteora_dev -d noteora
docker compose exec redis redis-cli -a "$env:REDIS_PASSWORD" ping
```
