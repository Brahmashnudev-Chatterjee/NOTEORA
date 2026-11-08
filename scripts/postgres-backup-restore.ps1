param([ValidateSet('backup','restore','verify')][string]$Action='verify')
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$backupDir=Join-Path $PSScriptRoot '..\database\backups'
New-Item -ItemType Directory -Force $backupDir | Out-Null

$backup=$null
if($Action -in @('backup','verify')){
  $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
  $backup=Join-Path $backupDir "noteora-$stamp.dump"
  $containerDump='/tmp/noteora-phase5b1.dump'
  docker compose exec -T postgres sh -lc 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/noteora-phase5b1.dump'
  if($LASTEXITCODE -ne 0){ throw 'PostgreSQL backup command failed' }
  docker compose cp "postgres:$containerDump" $backup
  if(-not (Test-Path $backup)){ throw 'PostgreSQL backup file was not created' }
}

if($Action -eq 'restore'){
  $backup=Get-ChildItem $backupDir -Filter '*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if(-not $backup){ throw 'No PostgreSQL backup exists for restore' }
  $backup=$backup.FullName
}

if($Action -in @('restore','verify')){
  docker compose exec -T postgres sh -lc 'dropdb --if-exists -U "$POSTGRES_USER" noteora_restore_verify; createdb -U "$POSTGRES_USER" noteora_restore_verify'
  docker compose cp $backup postgres:/tmp/noteora-phase5b1.dump
  docker compose exec -T postgres sh -lc 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d noteora_restore_verify /tmp/noteora-phase5b1.dump'
  if($LASTEXITCODE -ne 0){ throw 'PostgreSQL restore failed' }
  docker compose cp database/backup-restore-verification.sql postgres:/tmp/backup-restore-verification.sql
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U noteora_dev -d noteora_restore_verify -f /tmp/backup-restore-verification.sql
}
Write-Output $backup
