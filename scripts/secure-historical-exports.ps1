$ErrorActionPreference='Stop'
$workspace=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$source=[IO.Path]::GetFullPath((Join-Path $workspace 'database\export'))
$privateRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Noteora\preserved-exports'))
$archive=[IO.Path]::GetFullPath((Join-Path $privateRoot ('phase-e2-'+[guid]::NewGuid().ToString('N'))))
if(-not $source.StartsWith($workspace+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe export source'}
if(-not $archive.StartsWith($privateRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe archive destination'}
if((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse export source is not permitted'}
$files=@(Get-ChildItem -LiteralPath $source -File -Filter '*.json')
if($files.Count -eq 0){throw 'No historical exports to archive; existing archives were not changed'}
$identities=@([Security.Principal.WindowsIdentity]::GetCurrent().User,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'),[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
function Protect-Path([string]$path,[bool]$directory){
 if($directory){$acl=[Security.AccessControl.DirectorySecurity]::new();$inherit=[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'}
 else{$acl=[Security.AccessControl.FileSecurity]::new();$inherit=[Security.AccessControl.InheritanceFlags]::None}
 $acl.SetAccessRuleProtection($true,$false);$acl.SetOwner($identities[0])
 foreach($identity in $identities){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,[Security.AccessControl.FileSystemRights]::FullControl,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow))}
 Set-Acl -LiteralPath $path -AclObject $acl
}
New-Item -ItemType Directory -Force -Path $privateRoot | Out-Null
Protect-Path $privateRoot $true
New-Item -ItemType Directory -Path $archive | Out-Null
Protect-Path $archive $true
$manifest=@()
foreach($file in $files){
 if($file.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Reparse export file is not permitted'}
 $target=Join-Path $archive $file.Name
 Copy-Item -LiteralPath $file.FullName -Destination $target
 Protect-Path $target $false
 $before=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
 $after=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
 if($before -ne $after){throw 'Archive integrity check failed; original exports were retained'}
 $actual=(Get-Acl -LiteralPath $target).Access
 if(@($actual | Where-Object {$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $identities.Value}).Count){throw 'Unexpected archive access; originals retained'}
 $manifest+=@{file=$file.Name;sha256=$after;bytes=$file.Length;integrityMatched=$true;restrictedAclVerified=$true}
}
# All copies and access controls verified before any workspace copy is removed.
# These are local preserved exports, not a production database. No recursive delete.
foreach($file in $files){Remove-Item -LiteralPath $file.FullName}
$report=@{archivePath=$archive;files=$manifest;localWorkspaceCopiesRemoved=$true;productionDataChanged=$false;rotationPerformed=$false}
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $workspace 'docs\evidence\phase-e2\export-storage-verification.json') -Encoding UTF8
Write-Output ('Archived '+$files.Count+' exports; byte integrity and restricted access verified. No credentials were printed.')
