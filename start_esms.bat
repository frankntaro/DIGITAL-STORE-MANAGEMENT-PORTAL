@echo off
title KAMPANGO PHONES AND ELECTRONICS — ESMS Launcher
echo =====================================================================
echo   KAMPANGO PHONES AND ELECTRONICS (ESMS) — TZS Retail PWA
echo =====================================================================

echo [1/4] Checking MySQL Server (XAMPP)...
tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I /N "mysqld.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo Starting XAMPP MySQL...
    start "" /B "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone
    timeout /t 3 /nobreak >NUL
)

echo [2/4] Ensuring MySQL Database (esms_db) is migrated and seeded...
"C:\xampp\php\php.exe" "%~dp0backend\artisan" migrate

echo [3/4] Starting Laravel REST API Server on http://127.0.0.1:8000 ...
start "ESMS Laravel API" cmd /k "cd /d "%~dp0backend" && C:\xampp\php\php.exe artisan serve --host=127.0.0.1 --port=8000"

echo [4/4] Starting React PWA Dev Server on http://127.0.0.1:5173 ...
start "ESMS React PWA" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ESMS is starting! Open http://127.0.0.1:5173 in your browser.
