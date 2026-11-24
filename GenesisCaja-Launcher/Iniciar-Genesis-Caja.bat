@echo off
title Iniciando Genesis POS - Terminal de Ventas en Red
setlocal

REM Edita esta IP si cambia la direccion de tu PC Principal
set SERVER_URL=http://localhost:3000//?modo=ventas^&terminal=%COMPUTERNAME%

echo Conectando terminal %COMPUTERNAME% con PC Principal...
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%SERVER_URL%" --start-maximized
    exit /b
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%SERVER_URL%" --start-maximized
    exit /b
)

start "" "%SERVER_URL%"
