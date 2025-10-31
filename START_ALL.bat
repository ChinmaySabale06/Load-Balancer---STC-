@echo off
REM Platefull Load Balanced System - Windows Startup Script
REM This script starts all components of the load-balanced system

echo ================================================================
echo           PLATEFULL LOAD BALANCED SYSTEM LAUNCHER
echo ================================================================
echo.

REM Change to the script's directory
cd /d "%~dp0"

echo [1/5] Starting Server Instance 1 (Port 5001)...
start "Platefull-Instance-5001" cmd /k "cd server-instances && node start-instance.js 5001"
timeout /t 3 /nobreak >nul

echo [2/5] Starting Server Instance 2 (Port 5002)...
start "Platefull-Instance-5002" cmd /k "cd server-instances && node start-instance.js 5002"
timeout /t 3 /nobreak >nul

echo [3/5] Starting Server Instance 3 (Port 5003)...
start "Platefull-Instance-5003" cmd /k "cd server-instances && node start-instance.js 5003"
timeout /t 3 /nobreak >nul

echo [4/5] Starting Load Balancer (Port 8080)...
start "Platefull-LoadBalancer" cmd /k "cd load-balancer && node load-balancer.js"
timeout /t 3 /nobreak >nul

echo [5/5] Starting Dashboard (Port 3000)...
start "Platefull-Dashboard" cmd /k "cd dashboard && node server.js"
timeout /t 2 /nobreak >nul

echo.
echo ================================================================
echo                  ALL COMPONENTS STARTED!
echo ================================================================
echo.
echo  ^> Server Instance 1:  http://localhost:5001
echo  ^> Server Instance 2:  http://localhost:5002
echo  ^> Server Instance 3:  http://localhost:5003
echo  ^> Load Balancer:      http://localhost:8080
echo  ^> Admin Dashboard:    http://localhost:3000
echo.
echo Opening dashboard in browser...
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo System is running! Press any key to exit this window.
echo (Individual components will continue running in separate windows)
pause >nul
