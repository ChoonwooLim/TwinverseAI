@echo off
REM ============================================================
REM Install GPU Server autostart (Windows Startup folder shortcut)
REM ============================================================
REM Run this ONCE to register auto-start on boot.
REM To remove: delete the shortcut from the Startup folder.
REM ============================================================

set SCRIPT_PATH=C:\WORK\TwinverseAI\scripts\start_gpu_server.bat
set SHORTCUT_NAME=TwinverseDesk GPU Server.lnk
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

echo Creating startup shortcut...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTUP_DIR%\%SHORTCUT_NAME%'); $s.TargetPath = '%SCRIPT_PATH%'; $s.WorkingDirectory = 'C:\WORK\TwinverseAI\scripts'; $s.WindowStyle = 7; $s.Save()"

if exist "%STARTUP_DIR%\%SHORTCUT_NAME%" (
    echo.
    echo [OK] Auto-start registered!
    echo     Location: %STARTUP_DIR%\%SHORTCUT_NAME%
    echo     Script:   %SCRIPT_PATH%
    echo.
    echo GPU Server will start automatically on Windows login.
    echo To remove: delete "%STARTUP_DIR%\%SHORTCUT_NAME%"
) else (
    echo [FAIL] Could not create shortcut.
)

echo.
pause
