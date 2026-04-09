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

REM 1. Start Backend API
echo [1/3] Starting Backend API (port 8000)...
start "TwinverseAI Backend" cmd /c "cd /d C:\WORK\TwinverseAI\backend && uvicorn main:app --host 0.0.0.0 --port 8000"
timeout /t 3 /nobreak >nul

REM 2. Start Wilbur in background
echo [2/3] Starting Wilbur signaling server (8080/8888)...
start "Wilbur" cmd /c "cd /d \"D:\Program Files\UE_5.7\Engine\Plugins\Media\PixelStreaming2\Resources\WebServers\SignallingWebServer\" && node dist/index.js --serve --http_root www --streamer_port 8888 --player_port 8080 --console_messages verbose"
timeout /t 3 /nobreak >nul

REM 3. Start Cloudflare Tunnel
echo [3/3] Starting Cloudflare Tunnel...
start "CF Tunnel" cmd /c "\"%ProgramFiles(x86)%\cloudflared\cloudflared.exe\" tunnel run twinverse-ps2"

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
echo UE5 instances will be spawned on demand via the web UI.
echo.

pause
