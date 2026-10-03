# ============================================================================
# MinIO local para los adjuntos de documentos (S3 compatible).
#
#   pnpm minio            # descarga (si falta) el binario y arranca el server
#
# API:     http://localhost:9000
# Consola: http://localhost:9001   (usuario/clave = minioadmin / minioadmin)
# Datos:   .minio-data/  (ignorado por git)
#
# Sin Docker: usa el binario oficial de MinIO para Windows. Con Docker, el
# servicio `minio` de docker-compose.yml hace lo mismo.
# ============================================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$tools = Join-Path $root "tools"
$data = Join-Path $root ".minio-data"
$minio = Join-Path $tools "minio.exe"
$mc = Join-Path $tools "mc.exe"
$user = if ($env:AWS_ACCESS_KEY_ID) { $env:AWS_ACCESS_KEY_ID } else { "minioadmin" }
$pass = if ($env:AWS_SECRET_ACCESS_KEY) { $env:AWS_SECRET_ACCESS_KEY } else { "minioadmin" }
$bucket = if ($env:S3_BUCKET) { $env:S3_BUCKET } else { "com-adjuntos" }

New-Item -ItemType Directory -Force -Path $tools, $data | Out-Null
$ProgressPreference = "SilentlyContinue"

if (-not (Test-Path $minio)) {
  Write-Host "Descargando minio.exe (~108 MB)..."
  Invoke-WebRequest -UseBasicParsing "https://dl.min.io/server/minio/release/windows-amd64/minio.exe" -OutFile $minio
}
if (-not (Test-Path $mc)) {
  Write-Host "Descargando mc.exe..."
  Invoke-WebRequest -UseBasicParsing "https://dl.min.io/client/mc/release/windows-amd64/mc.exe" -OutFile $mc
}

# Crea el bucket en segundo plano en cuanto el server responda.
Start-Job -ScriptBlock {
  param($mc, $user, $pass, $bucket)
  for ($i = 0; $i -lt 30; $i++) {
    try {
      & $mc alias set localminio http://localhost:9000 $user $pass *> $null
      & $mc mb --ignore-existing localminio/$bucket *> $null
      if ($LASTEXITCODE -eq 0) { break }
    } catch {}
    Start-Sleep -Seconds 1
  }
} -ArgumentList $mc, $user, $pass, $bucket | Out-Null

$env:MINIO_ROOT_USER = $user
$env:MINIO_ROOT_PASSWORD = $pass
Write-Host "MinIO -> API :9000  Consola :9001  ($user / $pass)  bucket '$bucket'"
& $minio server $data --address ":9000" --console-address ":9001"
