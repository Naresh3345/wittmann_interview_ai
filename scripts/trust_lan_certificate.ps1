param(
    [string]$CertificatePath = ".certs\lan-server.crt"
)

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$resolvedCertificatePath = Resolve-Path (Join-Path $projectRoot $CertificatePath)

$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Error "Run PowerShell as Administrator, then run this script again."
    exit 1
}

Import-Certificate -FilePath $resolvedCertificatePath -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
Write-Host "Trusted LAN certificate installed for this Windows machine."
Write-Host "Restart Chrome/Edge, then open https://192.168.70.102:5000 again."
