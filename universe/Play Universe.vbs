' Double-click to start Boreal Universe with no console window.
' Starts Vite for the universe/ app and opens it in your browser.
Option Explicit
Dim sh, fso, dir, root, port, i, ok
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
root = fso.GetParentFolderName(dir)
sh.CurrentDirectory = dir
port = "5174"

If Not fso.FolderExists(root & "\node_modules") Then
  sh.CurrentDirectory = root
  sh.Run "cmd /c pnpm install || npm install", 0, True
  sh.CurrentDirectory = dir
End If

If PortOpen(port) Then
  sh.Run "http://127.0.0.1:" & port & "/", 1, False
  WScript.Quit 0
End If

If fso.FileExists(root & "\node_modules\.bin\vite.cmd") Then
  sh.Run "cmd /c ""..\node_modules\.bin\vite.cmd"" --config vite.config.ts --host 127.0.0.1 --port " & port, 0, False
ElseIf fso.FileExists(root & "\node_modules\vite\bin\vite.js") Then
  sh.Run "cmd /c node ""..\node_modules\vite\bin\vite.js"" --config vite.config.ts --host 127.0.0.1 --port " & port, 0, False
Else
  sh.Run "cmd /c npx --yes vite --config vite.config.ts --host 127.0.0.1 --port " & port, 0, False
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
  MsgBox "Boreal Universe did not start on port " & port & ". Check that Node.js is installed.", vbExclamation, "Boreal Universe"
End If

Function PortOpen(p)
  Dim e
  On Error Resume Next
  e = sh.Run("cmd /c powershell -NoProfile -Command ""$c=New-Object Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1'," & p & "); if($c.Connected){exit 0} else {exit 1} } catch { exit 1 } finally { $c.Close() }""", 0, True)
  PortOpen = (e = 0)
  On Error GoTo 0
End Function
