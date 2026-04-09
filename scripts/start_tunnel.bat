@echo off
REM ============================================================
REM Start Cloudflare Tunnel for PS2 GPU Server
REM ============================================================
REM Routes:
REM   ps2-api.twinverse.org → localhost:9000 (Spawner API)
REM   ps2.twinverse.org     → localhost:8080 (Wilbur Player)
REM ============================================================

echo.
echo ===== Cloudflare Tunnel (PS2) =====
echo.
echo PS2 API:    https://ps2-api.twinverse.org
echo PS2 Player: https://ps2.twinverse.org
echo.
echo Make sure these are running:
echo   1. Wilbur signaling server (port 8080/8888)
echo   2. PS2 Spawner server (port 9000)
echo.
echo Press Ctrl+C to stop tunnel.
echo.

cloudflared tunnel --config "%~dp0tunnel_config.yml" run twinverse-ps2
