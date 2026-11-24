@echo off
title Generador de Instalador - Genesis App
echo ========================================================
echo   GENERANDO INSTALADOR DE ESCRITORIO PARA GENESIS APP
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] No se detecto Node.js instalado en esta PC.
  echo Descargalo desde https://nodejs.org (version LTS) y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

echo [1/3] Instalando dependencias de escritorio (Electron y Builder)...
call npm install
if %errorlevel% neq 0 (
  echo [ERROR] Fallo la instalacion de dependencias.
  pause
  exit /b 1
)

echo.
echo [2/3] Compilando aplicacion y empaquetando instalador .EXE...
call npm run dist:win
if %errorlevel% neq 0 (
  echo [ERROR] Fallo la generacion del instalador.
  pause
  exit /b 1
)

echo.
echo ========================================================
echo   LISTO! Instalador generado en la carpeta: dist\
echo   Archivo: dist\Genesis-Instalador-30.2.0-Windows.exe
echo   Puedes copiar ese archivo .exe e instalarlo en cualquier PC!
echo ========================================================
pause
