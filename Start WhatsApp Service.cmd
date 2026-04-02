@echo off
setlocal
cd /d "%~dp0"
title Start WhatsApp Service

powershell -NoLogo -ExecutionPolicy Bypass -File ".\scripts\start-whatsapp-service.ps1" -Restart

echo.
pause
