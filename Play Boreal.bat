@echo off
REM Silent launcher: no console stays open. Double-click "Play Boreal.vbs" or this file.
cd /d "%~dp0"
wscript //nologo "%~dp0Play Boreal.vbs"
exit /b 0
