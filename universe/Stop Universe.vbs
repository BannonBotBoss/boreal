' Stop the Boreal Universe Vite server on port 5174 (hidden).
Option Explicit
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -ano ^| findstr :5174 ^| findstr LISTENING') do taskkill /F /PID %a", 0, True
