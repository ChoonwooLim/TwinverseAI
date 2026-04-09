@echo off
REM ============================================================
REM TwinverseDesk GPU Server — All-in-One Launcher
REM ============================================================
REM Starts everything needed for external PS2 access:
REM   1. Wilbur signaling server (8080/8888)
REM   2. PS2 Spawner API (9000)
REM   3. Cloudflare Tunnel (optional)
REM ============================================================

echo.
echo ===== TwinverseDesk GPU Server =====
echo.

REM 1. Start Wilbur in background
echo [1/3] Starting Wilbur signaling server...
start "Wilbur" cmd /c "cd /d \"D:\Program Files\UE_5.7\Engine\Plugins\Media\PixelStreaming2\Resources\WebServers\SignallingWebServer\" && node dist/index.js --serve --http_root www --streamer_port 8888 --player_port 8080 --console_messages verbose"
timeout /t 3 /nobreak >nul

REM 2. Start PS2 Spawner API in background
echo [2/3] Starting PS2 Spawner API (port 9000)...
start "PS2 Spawner" cmd /c "cd /d C:\WORK\TwinverseAI\backend && uvicorn ps2_server:app --host 0.0.0.0 --port 9000"
timeout /t 2 /nobreak >nul

REM 3. Start Cloudflare Tunnel (if configured)
where cloudflared >nul 2>&1
if not errorlevel 1 (
    if exist "%~dp0tunnel_config.yml" (
        echo [3/3] Starting Cloudflare Tunnel...
        start "CF Tunnel" cmd /c "cloudflared tunnel --config \"%~dp0tunnel_config.yml\" run twinverse-ps2"
    ) else (
        echo [3/3] Tunnel config not found, skipping...
    )
) else (
    echo [3/3] cloudflared not installed, skipping tunnel...
)

echo.
echo ===== GPU Server Ready =====
echo.
echo Wilbur:     http://localhost:8080 (player) / ws://localhost:8888 (signaling)
echo Spawner:    http://localhost:9000/api/ps2/health
echo Swagger:    http://localhost:9000/docs
echo.
echo If tunnel is running:
echo   PS2 API:  https://ps2-api.twinverse.org
echo   Player:   https://ps2.twinverse.org
echo.
echo UE5 instances will be spawned on demand via the API.
echo Close this window to see running services.
echo.

pause
