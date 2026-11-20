@echo off
title 2. Duong Ham HTTPS Auto-Reconnect
cd /d d:\antigravity\app-hoc-tieng-anh

:loop
echo ===================================================
echo  Dang ket noi Duong Ham HTTPS Cloudflare Tunnel...
echo ===================================================
"%LOCALAPPDATA%\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8000 --logfile tunnel.log
echo.
echo ===================================================
echo  [CANH BAO] Duong ham bi mat ket noi!
echo  Dang tu dong ket noi lai sau 3 giay...
echo ===================================================
ping -n 4 127.0.0.1 >nul
goto loop
