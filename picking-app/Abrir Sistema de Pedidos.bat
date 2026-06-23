@echo off
setlocal enabledelayedexpansion
title Sistema de Pedidos - servidor local (no cerrar)
cd /d "%~dp0"

set PORT=8080

REM Detectar Python (python o py)
set PYCMD=
where python >nul 2>nul && set PYCMD=python
if "%PYCMD%"=="" ( where py >nul 2>nul && set PYCMD=py )
if "%PYCMD%"=="" (
  echo [ERROR] No encontre Python instalado.
  echo Instalalo desde https://www.python.org/downloads/  ^(marca "Add to PATH"^)
  echo.
  pause
  exit /b 1
)

REM --- Detectar IP(s) locales privadas (192.168.x / 10.x / 172.16-31.x) ---
set "IPFILE=%TEMP%\_pedidos_ips.txt"
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)' } | Sort-Object InterfaceMetric | Select-Object -ExpandProperty IPAddress" > "%IPFILE%" 2>nul

set "LANIP="
for /f "usebackq delims=" %%i in ("%IPFILE%") do (
  if not defined LANIP set "LANIP=%%i"
)

cls
echo ============================================================
echo   Sistema de Pedidos - servidor local
echo ============================================================
echo.
echo   EN ESTA PC:
echo       http://localhost:%PORT%
echo.
echo   EN EL CELULAR (tiene que estar en la MISMA red Wi-Fi):
if defined LANIP (
  echo       http://!LANIP!:%PORT%
  echo.
  echo   Si esa no anda, proba con alguna de estas:
  for /f "usebackq delims=" %%i in ("%IPFILE%") do echo       http://%%i:%PORT%
) else (
  echo       No pude detectar la IP automaticamente.
  echo       Abri otra ventana de cmd, escribi:  ipconfig
  echo       y busca "Direccion IPv4" (empieza con 192.168 o 10.)
)
echo.
echo   IMPORTANTE: deja esta ventana ABIERTA mientras lo uses.
echo   Si Windows pregunta por el Firewall, tilda "Redes privadas" y Aceptar.
echo ============================================================
echo.

REM Abrir el navegador de la PC
start "" cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%"

REM Servidor escuchando en todas las interfaces (para que entre el celular)
%PYCMD% -m http.server %PORT% --bind 0.0.0.0

echo.
echo Servidor detenido.
pause
