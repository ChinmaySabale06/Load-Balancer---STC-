@echo off
REM Stop all components of the load-balanced system

echo ================================================================
echo         STOPPING PLATEFULL LOAD BALANCED SYSTEM
echo ================================================================
echo.

echo Terminating all Node.js processes related to the system...

REM Kill processes by window title
taskkill /FI "WINDOWTITLE eq Platefull-Instance-5001*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Platefull-Instance-5002*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Platefull-Instance-5003*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Platefull-LoadBalancer*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Platefull-Dashboard*" /F >nul 2>&1

echo.
echo All components stopped!
echo.
pause
