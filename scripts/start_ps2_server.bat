@echo off
REM ============================================================
REM PS2 Spawner Server (GPU Server)
REM ============================================================
REM This PC runs as a GPU server for Pixel Streaming.
REM Spawner API: http://0.0.0.0:9000
REM Wilbur must be running on port 8080/8888.
REM ============================================================

echo.
echo ===== PS2 Spawner Server (GPU) =====
echo.
echo API: http://localhost:9000
echo Health: http://localhost:9000/api/ps2/health
echo Docs: http://localhost:9000/docs
echo.

cd /d "C:\WORK\TwinverseAI\backend"
uvicorn ps2_server:app --host 0.0.0.0 --port 9000 --reload

pause
