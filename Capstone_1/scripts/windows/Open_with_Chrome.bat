@echo off
title UnityBank - Launch in Chrome
cd /d "%~dp0..\.."

echo [UnityBank] Checking API core server...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/api/v1/health' -TimeoutSec 1 -UseBasicParsing; Write-Host 'Core backend online.' } catch { Write-Host 'Starting background backend server...'; Start-Process python -ArgumentList '-m uvicorn backend.app:app --host 127.0.0.1 --port 8000' -WindowStyle Hidden; Start-Sleep -Seconds 2 }"

echo [UnityBank] Launching Google Chrome...
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://127.0.0.1:8000"
) else (
    start "" "%CD%\frontend\index.html"
)
exit
