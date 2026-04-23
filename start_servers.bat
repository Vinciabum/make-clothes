@echo off
REM UNC 경로(\\server\share\...)에서도 동작하도록 pushd 로 임시 드라이브에 매핑.
REM %~dp0 = 이 .bat 파일이 있는 폴더 (끝에 \ 포함)

echo Starting Backend Server...
start "Backend" cmd /k "pushd ""%~dp0server"" && npm start"

echo Starting Frontend Server...
start "Frontend" cmd /k "pushd ""%~dp0"" && npm run dev"

echo Both servers are starting! You can close this window.
