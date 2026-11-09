' Creates a Desktop shortcut to Play Boreal (no console).
' Double-click this once after cloning/pulling the repo.
Option Explicit
Dim sh, fso, dir, desktop, linkPath, play, ico, link
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
play = dir & "\Play Boreal.vbs"
If Not fso.FileExists(play) Then
  MsgBox "Play Boreal.vbs was not found next to this installer." & vbCrLf & dir, vbCritical, "Boreal"
  WScript.Quit 1
End If

desktop = sh.SpecialFolders("Desktop")
If desktop = "" Then desktop = sh.ExpandEnvironmentStrings("%USERPROFILE%\Desktop")
linkPath = desktop & "\Boreal.lnk"

Set link = sh.CreateShortcut(linkPath)
link.TargetPath = "wscript.exe"
link.Arguments = "//nologo """ & play & """"
link.WorkingDirectory = dir
link.WindowStyle = 7
link.Description = "Play Boreal — Generate universe (no terminal)"
ico = dir & "\public\favicon.ico"
If fso.FileExists(ico) Then link.IconLocation = ico
link.Save

MsgBox "Desktop shortcut created:" & vbCrLf & linkPath & vbCrLf & vbCrLf & "Double-click ""Boreal"" on your Desktop to play.", vbInformation, "Boreal"
