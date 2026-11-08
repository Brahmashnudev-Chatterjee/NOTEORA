# PostgreSQL Backup and Restore — Phase 5B.1

## Commands

Create a custom-format backup and restore it:

```powershell
npm run postgres:restore
```

Create only a backup or restore the latest backup:

```powershell
npm run postgres:backup
powershell -ExecutionPolicy Bypass -File scripts/postgres-backup-restore.ps1 -Action restore
```

Backups are written beneath `database/backups`.

## Verified restoration

The development backup created `database/backups/noteora-20261108-233857.dump` and restored it into `noteora_restore_verify` successfully.

Restored verification:

- Marketplace and gateway application tables: 34
- Restored users: 3

`pg_restore` uses `--no-owner` to avoid ownership assumptions. This test restores to a throwaway development database only and does not modify MongoDB or production data.

## Remaining operational work

Automated scheduled backups, off-host retention, encryption-at-rest, restore alarms and documented recovery-point objectives remain deployment operational tasks.
