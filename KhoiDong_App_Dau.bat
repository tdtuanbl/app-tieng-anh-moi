@echo off
title Khoi Dong App Tieng Anh Cho Be Dau
cd /d d:\antigravity\app-hoc-tieng-anh

echo ======================================================================
echo              DANG KHOI DONG APP TIENG ANH CHO BE DAU
echo ======================================================================
echo.
echo  1. Link noi bo gia dinh: http://192.168.1.9:8000
echo  2. Link HTTPS cho Safari iPad: Xem tai Cua so 2
echo.
echo ======================================================================

:: 1. Mo cua so Server Backend tren cong 8000
start "1. Server Backend Port 8000" cmd /k "cd /d d:\antigravity\app-hoc-tieng-anh && call run_server.bat"

:: Cho 4 giay de FastAPI Server khoi tao xong tren cong 8000 truoc
ping -n 5 127.0.0.1 >nul

:: 2. Mo cua so Duong ham Cloudflare Tunnel tu dong ket noi lai
start "2. Duong Ham HTTPS Auto-Reconnect" cmd /k "cd /d d:\antigravity\app-hoc-tieng-anh && call run_tunnel.bat"

echo.
echo  Da bat thanh cong 2 cua so he thong!
ping -n 4 127.0.0.1 >nul
