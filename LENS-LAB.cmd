@echo off
setlocal
cd /d "%~dp0"
title LENS LAB - Launcher
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch.ps1"
if errorlevel 1 (
  echo.
  echo LENS LAB could not start. Review logs\launcher.log for details.
  echo.
  pause
)
endlocal
