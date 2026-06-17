' BackOffice / SmartKart launcher.
' Opens the SmartKart web app in Google Chrome with Local Network Access
' enforcement disabled, so the page can reach the local Print Helper on
' https://localhost:9443 without Chrome blocking the loopback request.
'
' Usage: wscript.exe LaunchSmartKart.vbs "https://qa.smartkart.app"
'        (URL is also hard-coded as a fallback if no argument is passed.)

Option Explicit

Dim DefaultUrl
DefaultUrl = "https://qa.smartkart.app"

Dim TargetUrl
If WScript.Arguments.Count >= 1 Then
    TargetUrl = WScript.Arguments(0)
Else
    TargetUrl = DefaultUrl
End If

Dim shell, fso
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

Dim chromePath
chromePath = FindChrome(shell, fso)

If chromePath = "" Then
    MsgBox "Google Chrome was not found on this PC." & vbCrLf & vbCrLf & _
           "Install Chrome from https://www.google.com/chrome and try again.", _
           vbExclamation Or vbOKOnly, "SmartKart BackOffice"
    WScript.Quit 1
End If

Dim flags
flags = "--disable-features=BlockInsecurePrivateNetworkRequests,LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults"

Dim cmd
cmd = """" & chromePath & """ " & flags & " --new-window " & TargetUrl

' WindowStyle=1 (normal), bWaitOnReturn=False (return immediately).
shell.Run cmd, 1, False

Function FindChrome(shell, fso)
    Dim candidates(4), i, path
    candidates(0) = shell.ExpandEnvironmentStrings("%ProgramFiles%\Google\Chrome\Application\chrome.exe")
    candidates(1) = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe")
    candidates(2) = shell.ExpandEnvironmentStrings("%LocalAppData%\Google\Chrome\Application\chrome.exe")
    candidates(3) = ReadChromePathFromRegistry(shell)
    candidates(4) = ""

    For i = 0 To UBound(candidates)
        path = candidates(i)
        If path <> "" Then
            If fso.FileExists(path) Then
                FindChrome = path
                Exit Function
            End If
        End If
    Next
    FindChrome = ""
End Function

Function ReadChromePathFromRegistry(shell)
    On Error Resume Next
    ReadChromePathFromRegistry = shell.RegRead("HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe\")
    If Err.Number <> 0 Then ReadChromePathFromRegistry = ""
    Err.Clear
    On Error Goto 0
End Function
