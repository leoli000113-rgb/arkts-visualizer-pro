@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==================================
echo   ArkTS Visualizer Pro Launcher
echo ==================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
echo.
echo Server stopped. Press any key to exit.
pause >nul
