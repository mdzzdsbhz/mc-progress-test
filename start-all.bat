@echo off
setlocal

set "FRONTEND_DIR=D:\projects_pro\mc-progress-test\web"
set "BACKEND_DIR=D:\projects_pro\mc-progress-test\server"

wt -w 0 ^
  new-tab -d "%FRONTEND_DIR%" cmd /k "title FE:web && npm run dev" ^
  ; split-pane -H -d "%BACKEND_DIR%" cmd /k "title BE:server && python -m uvicorn --app-dir . main:app --host 127.0.0.1 --port 8000 --reload --reload-dir ." ^
  ; focus-tab -t 0