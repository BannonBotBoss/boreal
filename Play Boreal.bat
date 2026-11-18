@echo off
title Boreal (close this window to stop the game)
cd /d "%~dp0"
if not exist node_modules (
  echo First run: installing packages...
  call pnpm install || call npm install
)
echo Starting Boreal. Your browser will open in a moment.
call pnpm dev --open || call npm run dev -- --open
pause
