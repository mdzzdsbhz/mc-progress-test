@echo off
setlocal
rem 进入脚本所在目录
cd /d "%~dp0"



rem 启动 Uvicorn
echo 启动 Uvicorn 服务器...
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

endlocal