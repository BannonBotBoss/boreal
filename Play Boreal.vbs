' Double-click to start Boreal with no console window.
' Starts Vite in the background and opens the game in your browser.
Option Explicit
Dim sh, fso, dir, port, i, ok
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
port = "5173"

If Not fso.FolderExists(dir & "\node_modules") Then
  sh.Run "cmd /c pnpm install || npm install", 0, True
End If

' Already running? Just open the browser.
If PortOpen(port) Then
  sh.Run "http://127.0.0.1:" & port & "/", 1, False
  WScript.Quit 0
End If

' Hidden Vite (0 = hide window). Prefer local binaries so PATH is not required.
If fso.FileExists(dir & "\node_modules\.bin\vite.cmd") Then
  sh.Run "cmd /c ""node_modules\.bin\vite.cmd"" --host 127.0.0.1 --port " & port, 0, False
ElseIf fso.FileExists(dir & "\node_modules\vite\bin\vite.js") Then
  sh.Run "cmd /c node ""node_modules\vite\bin\vite.js"" --host 127.0.0.1 --port " & port, 0, False
Else
  sh.Run "cmd /c npx --yes vite --host 127.0.0.1 --port " & port, 0, False
End If

For i = 1 To 60
  WScript.Sleep 500
  If PortOpen(port) Then
    ok = True
    Exit For
  End If
Next

If ok Then
  sh.Run "http://127.0.0.1:" & port & "/", 1, False
Else
  MsgBox "Boreal did not start on port " & port & ". Check that Node.js is installed.", vbExclamation, "Boreal"
End If

Function PortOpen(p)
  Dim e
  On Error Resume Next
  e = sh.Run("cmd /c powershell -NoProfile -Command ""$c=New-Object Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1'," & p & "); if($c.Connected){exit 0} else {exit 1} } catch { exit 1 } finally { $c.Close() }""", 0, True)
  PortOpen = (e = 0)
  On Error GoTo 0
End Function
