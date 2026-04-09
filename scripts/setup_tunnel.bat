@echo off
REM ============================================================
REM Cloudflare Tunnel Setup for PS2 GPU Server
REM ============================================================
REM Exposes this PC's PS2 services to the internet:
REM   - PS2 Spawner API (port 9000) → ps2-api.twinverse.org
REM   - Wilbur Player (port 8080)   → ps2.twinverse.org
REM
REM Prerequisites:
REM   1. Install cloudflared: winget install Cloudflare.cloudflared
REM   2. Login: cloudflared tunnel login
REM   3. Create tunnel: cloudflared tunnel create twinverse-ps2
REM   4. Configure DNS in Cloudflare dashboard
REM ============================================================

echo.
echo ===== Cloudflare Tunnel Setup =====
echo.

REM Step 1: Check if cloudflared is installed
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo [!] cloudflared not found. Installing...
    winget install Cloudflare.cloudflared
    echo.
    echo Please restart this script after installation.
    pause
    exit /b
)

echo [OK] cloudflared found
cloudflared --version
echo.

REM Step 2: Check if logged in
echo Checking Cloudflare login status...
cloudflared tunnel list >nul 2>&1
if errorlevel 1 (
    echo [!] Not logged in. Opening browser for authentication...
    cloudflared tunnel login
)

echo.
echo ===== Setup Complete =====
echo.
echo Next steps:
echo   1. Create tunnel:  cloudflared tunnel create twinverse-ps2
echo   2. Run tunnel:     scripts\start_tunnel.bat
echo.

pause
