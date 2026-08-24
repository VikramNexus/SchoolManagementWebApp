@echo off
title Building Aryavart Portal APK
echo ===================================================
echo   Building Aryavart Portal Production APK...
echo ===================================================
cd /d "%~dp0frontend"
echo [1/3] Building Web Frontend...
call npm run build
echo [2/3] Syncing Android Assets...
call npx cap sync android
cd /d "%~dp0frontend\android"
set "JAVA_HOME=%~dp0jdk-21\jdk-21.0.6+7"
set "Path=%JAVA_HOME%\bin;%Path%"
echo [3/3] Compiling Secure Signed Android APK...
call gradlew.bat assembleRelease
copy /y "%~dp0frontend\android\app\build\outputs\apk\release\app-release.apk" "%~dp0AryavartPortal.apk"
echo.
echo ===================================================
echo   SUCCESS! Production Signed APK Generated:
echo   File: %~dp0AryavartPortal.apk
echo ===================================================
pause

