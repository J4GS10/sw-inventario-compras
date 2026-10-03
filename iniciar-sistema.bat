@echo off
setlocal

set "PROJECT_DIR=%~dp0"

echo ================================================================
echo   Levantando el sistema de Gestion de Compras (Clavos S.A.)
echo   Carpeta: %PROJECT_DIR%
echo ================================================================
echo.

echo [1/4] Verificando Oracle (puerto 1521) ...
powershell -NoProfile -Command ^
  "if (Test-NetConnection -ComputerName localhost -Port 1521 -InformationLevel Quiet -WarningAction SilentlyContinue) { Write-Host '      OK: Oracle responde en 1521.' -ForegroundColor Green } else { Write-Host '      AVISO: Oracle NO responde en el puerto 1521.' -ForegroundColor Yellow; Write-Host '      Inicia el servicio de Oracle (services.msc) antes de continuar.' -ForegroundColor Yellow }"

echo.
echo [2/4] Iniciando MinIO (almacenamiento S3 local, adjuntos) ...
start "MinIO - S3 local (9000/9001)" cmd /k "cd /d %PROJECT_DIR% && pnpm minio"

echo [3/4] Iniciando backend (:3000) y frontend (:8443) ...
start "Compras - Backend + Frontend" cmd /k "cd /d %PROJECT_DIR% && pnpm dev"

echo.
echo [4/4] Esperando a que el frontend levante ...
timeout /t 12 /nobreak >nul

start "" "http://localhost:8443"

echo.
echo ================================================================
echo   Listo. Se abrieron 2 ventanas (MinIO y Backend+Frontend):
echo   dejalas abiertas mientras uses el sistema.
echo   El navegador deberia abrir en http://localhost:8443
echo   (si carga en blanco, espera unos segundos y recarga: F5)
echo ================================================================
echo.
pause
