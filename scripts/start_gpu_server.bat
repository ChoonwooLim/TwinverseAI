@echo off
REM ============================================================
REM TwinverseDesk GPU Server — All-in-One Launcher
REM ============================================================
REM Starts everything needed for external PS2 access:
REM   1. Backend API (8000) — PS2 spawn/heartbeat/terminate
REM   2. Wilbur signaling server (8080/8888)
REM   3. Cloudflare Tunnel (ps2-api / ps2.twinverse.org)
REM ============================================================

echo.
echo ===== TwinverseDesk GPU Server =====
echo.

REM Kill any leftover processes from previous session
taskkill /F /FI "WINDOWTITLE eq TwinverseAI Backend" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Wilbur" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq CF Tunnel" >nul 2>&1

REM Wait for cleanup
timeout /t 2 /nobreak >nul

REM Force UTF-8 mode for this process tree (belt for the .env cp949 guard)
set PYTHONUTF8=1

REM [0/3] Pre-flight — fail LOUD before anything else launches.
REM   Validates .env is UTF-8 + ASCII-only, imports backend.main to catch any
REM   startup crash upfront. Without this, a silent backend crash manifests as
REM   a browser CORS error (tunnel returns 502) — see bugfix-log 2026-04-10.
echo [0/3] Running pre-flight backend readiness check...
python "%~dp0check_backend_ready.py"
if errorlevel 1 (
    echo.
    echo ============================================================
    echo  PRE-FLIGHT FAILED — refusing to launch GPU server.
    echo  Fix the error above, then re-run start_gpu_server.bat.
    echo ============================================================
    echo.
    pause
    exit /b 1
)
echo.

REM 1. Start Backend API
REM   PYTHONUTF8=1 forces UTF-8 for all file reads (defense-in-depth — load_dotenv
REM   also passes encoding='utf-8' explicitly since 2026-04-10).
echo [1/3] Starting Backend API (port 8000)...
start "TwinverseAI Backend" /min cmd /c "set PYTHONUTF8=1&& cd /d C:\WORK\TwinverseAI\backend && uvicorn main:app --host 0.0.0.0 --port 8000"
timeout /t 5 /nobreak >nul

REM Post-launch health poll — confirm the process actually came up.
REM If uvicorn crashed after start, this surfaces it LOUDLY instead of letting
REM the tunnel return 502s that look like CORS errors in the browser.
echo     Verifying backend health...
python "%~dp0check_backend_ready.py" --health http://localhost:8000/health 30
if errorlevel 1 (
    echo.
    echo ============================================================
    echo  BACKEND HEALTH CHECK FAILED — uvicorn likely crashed.
    echo  Open the 'TwinverseAI Backend' window to see the traceback.
    echo ============================================================
    echo.
    pause
    exit /b 1
)
echo.

REM 2. Start Wilbur signaling server
echo [2/3] Starting Wilbur signaling server (8080/8888)...
start "Wilbur" /min cmd /c "cd /d "D:\Program Files\UE_5.7\Engine\Plugins\Media\PixelStreaming2\Resources\WebServers\SignallingWebServer" && node dist/index.js --serve --http_root www --streamer_port 8888 --player_port 8080 --console_messages verbose"
timeout /t 3 /nobreak >nul

REM 3. Start Cloudflare Tunnel
echo [3/3] Starting Cloudflare Tunnel...
start "CF Tunnel" /min cmd /c ""C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel run twinverse-ps2"

echo.
echo ===== GPU Server Ready =====
echo.
echo Backend:    http://localhost:8000
echo Wilbur:     http://localhost:8080 (player) / ws://localhost:8888 (signaling)
echo.
echo External (Cloudflare Tunnel):
echo   PS2 API:  https://ps2-api.twinverse.org
echo   Player:   https://ps2.twinverse.org
echo.
echo Orbitron site: https://twinverseai.twinverse.org/twinversedesk/launch
echo.
echo All 3 services started minimized. Check taskbar if needed.
echo This window can be closed safely.
echo.
