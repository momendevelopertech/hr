@echo off
setlocal
cd /d "%~dp0"
title Start Local HR Stack

powershell -NoLogo -ExecutionPolicy Bypass -File ".\scripts\start-local-hr-stack.ps1" -Restart

echo.
pause
