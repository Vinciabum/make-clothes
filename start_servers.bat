@echo off
echo Starting Backend Server...
start cmd /k "cd server && npm start"

echo Starting Frontend Server...
start cmd /k "npm run dev"

echo Both servers are starting! You can close this window.
