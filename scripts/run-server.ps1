# Arranca el servidor Ambient para la demo local (T005).
# No guarda secretos: la clave se toma de $env:Ambient__PairingKey o se pide
# interactivamente y sólo vive en la sesión.
#
# Uso:
#   ./scripts/run-server.ps1                 # puerto 5189, sirve dist compilado
#   ./scripts/run-server.ps1 -Port 5189 -PublicOrigin http://localhost:5173
#
# Para desarrollo con Vite (Opción B del runbook) pasar -PublicOrigin con el
# origen del dev server. Ver docs/runbooks/local-development.md.

param(
    [int]$Port = 5189,
    [string]$PublicOrigin = '',
    [string]$AllowedHosts = 'localhost;127.0.0.1;10.0.2.2'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')

if ([string]::IsNullOrWhiteSpace($env:Ambient__PairingKey)) {
    $secure = Read-Host -AsSecureString 'Clave de emparejamiento local (no se guarda)'
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $env:Ambient__PairingKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if ([string]::IsNullOrWhiteSpace($env:Ambient__PairingKey)) {
    throw 'Se requiere una clave de emparejamiento (Ambient__PairingKey).'
}

$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Ambient__Transport = 'DevelopmentHttp'
$env:AllowedHosts = $AllowedHosts
if (-not [string]::IsNullOrWhiteSpace($PublicOrigin)) {
    $env:Ambient__PublicOrigin = $PublicOrigin
}

$distPath = Join-Path $repoRoot 'src/ambient-client/dist/index.html'
if (-not (Test-Path $distPath)) {
    Write-Warning "No existe $distPath. Compilá el frontend (cd src/ambient-client; npm ci; npm run build) para servir /control y /display."
}

Write-Host "Servidor en http://localhost:$Port  (Origin esperado: $(if ($PublicOrigin) { $PublicOrigin } else { "http://localhost:$Port" }))"
dotnet run --project (Join-Path $repoRoot 'src/Ambient.Server') --no-launch-profile --urls "http://localhost:$Port"
