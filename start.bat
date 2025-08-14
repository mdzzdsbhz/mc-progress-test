@echo off

REM Start the backend server
echo Starting backend server...
start cmd /k "cd /d D:\projects_pro\mc-progress-test\server && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

REM Start the frontend development server
echo Starting frontend development server...
start cmd /k "cd /d D:\projects_pro\mc-progress-test\web && npm run dev"

echo Both servers are starting in separate windows.
exit