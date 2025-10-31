@echo off
REM Quick start script - Installs dependencies and starts the system

echo ================================================================
echo      PLATEFULL LOAD BALANCER - FIRST TIME SETUP
echo ================================================================
echo.

cd /d "%~dp0"

echo [1/4] Installing Load Balancer dependencies...
cd load-balancer
call npm install
cd ..

echo.
echo [2/4] Installing Dashboard dependencies...
cd dashboard
call npm install
cd ..

echo.
echo [3/4] Installing Server Instance dependencies...
cd server-instances
call npm install
cd ..

echo.
echo [4/4] Setup complete!
echo.
echo ================================================================
echo                  INSTALLATION COMPLETE
echo ================================================================
echo.
echo You can now start the system with START_ALL.bat
echo.
pause
