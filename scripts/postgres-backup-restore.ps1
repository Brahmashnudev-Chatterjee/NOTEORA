param([ValidateSet('backup','restore','verify')][string]$Action='verify', [string]$SourceDatabase=$env:POSTGRES_DB)
$ErrorActionPreference='Stop'
if($SourceDatabase -notmatch '^[a-z][a-z0-9_]*_(test|development)$'){ throw 'Explicit isolated SourceDatabase ending in _test or _development is required. No production database is authorised.' }
Set-Location (Split-Path -Parent $PSScriptRoot)
$backupDir=Join-Path $PSScriptRoot '..\database\backups'
New-Item -ItemType Directory -Force $backupDir | Out-Null

$backup=$null
if($Action -in @('backup','verify')){
  $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
  $backup=Join-Path $backupDir "noteora-$stamp.dump"
  $containerDump='/tmp/noteora-phase5b1.dump'
  docker compose exec -T postgres sh -lc 'umask 077; export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_dump -Fc -U "$POSTGRES_USER" -d "$1" -f /tmp/noteora-phase5b1.dump' sh $SourceDatabase
  if($LASTEXITCODE -ne 0){ throw 'PostgreSQL backup command failed' }
  docker compose cp "postgres:$containerDump" $backup
  if($LASTEXITCODE -ne 0){ throw 'Backup copy failed' }
  if(-not (Test-Path $backup)){ throw 'PostgreSQL backup file was not created' }
}

if($Action -eq 'restore'){
  $backup=Get-ChildItem $backupDir -Filter '*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if(-not $backup){ throw 'No PostgreSQL backup exists for restore' }
  $backup=$backup.FullName
}

if($Action -in @('restore','verify')){
  $restoreDatabase='noteora_restore_'+(Get-Date -Format 'yyyyMMddHHmmss')+'_'+([guid]::NewGuid().ToString('N').Substring(0,8))+'_test'
  docker compose exec -T postgres sh -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec createdb -U "$POSTGRES_USER" "$1"' sh $restoreDatabase
  if($LASTEXITCODE -ne 0){ throw 'Fresh restore database creation failed' }
  docker compose cp $backup postgres:/tmp/noteora-phase5b1.dump
  if($LASTEXITCODE -ne 0){ throw 'Restore input copy failed' }
  docker compose exec -T postgres sh -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$1" /tmp/noteora-phase5b1.dump' sh $restoreDatabase
  if($LASTEXITCODE -ne 0){ throw 'PostgreSQL restore failed' }
  docker compose cp database/backup-restore-verification.sql postgres:/tmp/backup-restore-verification.sql
  if($LASTEXITCODE -ne 0){ throw 'Verification SQL copy failed' }
  docker compose exec -T postgres sh -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1" -f /tmp/backup-restore-verification.sql' sh $restoreDatabase
  if($LASTEXITCODE -ne 0){ throw 'Restore verification failed' }
  Write-Output "Disposable restore database retained: $restoreDatabase"
}
Write-Output $backup
