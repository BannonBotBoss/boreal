' Creates a Desktop shortcut to Play Universe.vbs (silent launcher).
Option Explicit
Dim sh, fso, dir, desktop, link
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
desktop = sh.SpecialFolders("Desktop")
Set link = sh.CreateShortcut(desktop & "\Boreal Universe.lnk")
link.TargetPath = dir & "\Play Universe.vbs"
link.WorkingDirectory = dir
link.WindowStyle = 7
link.Description = "Boreal Universe (no console)"
link.Save
MsgBox "Desktop shortcut created: Boreal Universe", vbInformation, "Boreal Universe"
