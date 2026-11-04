@echo off
title Agent - Autonomous Real-Time Voice AI
echo ======================================================================
echo          AGENT · AUTONOMOUS TWO-WAY VOICE AI ^& IOT COPILOT
echo ======================================================================
echo.
echo [1/2] Starting Local Python Orchestrator Bridge on 0.0.0.0:8765 ...
start /B "" python "%~dp0voice_agent_bridge.py" >nul 2>&1
timeout /t 1 >nul

echo [2/2] Launching Agent Voice AI in your default browser...
start "" "%~dp0index.html"

echo.
echo ======================================================================
echo  Agent Voice AI is now LIVE across PC ^& Mobile!
echo  - Wake Word:          Just say "Agent" to activate hands-free
echo  - Local PC Browser:   http://127.0.0.1:8765 or index.html
echo  - Mobile Phone/WiFi:  Open http://192.168.29.56:8765 on your phone
echo  - Live Two-Way Voice: Continuous full-duplex speech conversation
echo  - Instant Barge-In:   Speak mid-sentence to interrupt Agent immediately
echo  - Mobile Push-to-Talk: Touch ^& hold orb to talk walkie-talkie style
echo  - Background Tasks:   Code execution, telemetry, and IoT relay control
echo ======================================================================
echo.
echo Press any key to stop the local bridge and close this window...
pause >nul
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
exit
