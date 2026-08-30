@echo off
title Building Aryavart Portal APK
echo ===================================================
echo   Building Aryavart Portal Live-Sync APK...
echo ===================================================
set "ROOT_DIR=%~dp0"
node "%ROOT_DIR%frontend\scripts\build_apk.cjs"
if %errorlevel% neq 0 (
  echo.
  echo [!] Error occurred during APK build.
  pause
  exit /b %errorlevel%
)
echo.
pause


