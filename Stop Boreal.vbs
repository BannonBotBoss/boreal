' Stops the hidden Vite / Node process listening on the Boreal port.
Option Explicit
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %a", 0, True
