@echo off
title Agent - Autonomous Real-Time Voice AI
echo ======================================================================
echo          AGENT · AUTONOMOUS TWO-WAY VOICE AI ^& IOT COPILOT
echo ======================================================================
echo.
echo [1/3] Starting Local Python Orchestrator Bridge on 0.0.0.0:8765 ...
start /B "" python "%~dp0voice_agent_bridge.py" >>"%~dp0bridge.log" 2>&1
timeout /t 1 >nul

if exist "%~dp0maya_tts_server.py" (
    echo [2/3] Starting Local Maya 2 Voice Cloning Server on 0.0.0.0:8766 ...
    start /B "" python "%~dp0maya_tts_server.py" >>"%~dp0maya.log" 2>&1
    timeout /t 1 >nul
) else (
    echo [2/3] Local Maya 2 server not found (skipping voice cloning server).
)

echo [3/3] Launching Agent Voice AI in your browser...
start "" "http://127.0.0.1:8765"

echo.
echo ======================================================================
echo  Agent Voice AI is now LIVE locally on your PC!
echo  - Local PC URL:       http://127.0.0.1:8765
echo  - Voice Bridge:       Port 8765 (Active)
echo  - Logs:               bridge.log / maya.log
echo  - Languages:          Hindi, Odia, English + Avengers Voice Clones
echo ======================================================================
echo.
echo Press any key to stop all local servers and close this window...
pause >nul
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8765,8766 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
exit
