@echo off
title 1. Server Backend Port 8000
cd /d d:\antigravity\app-hoc-tieng-anh
echo ===================================================
echo  Dang khoi dong FastAPI Server cong 8000...
echo ===================================================
.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
pause
