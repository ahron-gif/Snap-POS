; BackOffice Print Agent - Inno Setup script
; Compile with ISCC.exe (Inno Setup 6.2+).
;
; Produces a single Setup.exe that:
;   - Auto-stops + removes any previous BackOfficePrintAgent service
;   - Copies the published agent EXE + SumatraPDF.exe to {app}
;   - Registers the service under LocalSystem or a chosen user account
;   - Configures recovery actions and Application event-log source
;   - Registers in Add/Remove Programs for clean uninstall

#define MyAppName "BackOffice Print Agent"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "RDT Systems"
#define MyAppURL "https://www.rdtsystems.com"
#define MyAppExeName "BackOfficePrintAgent.exe"
#define MyServiceName "BackOfficePrintAgent"
#define MyServiceDisplay "BackOffice Print Agent"
#define MyServiceDescription "Local print helper for the BackOffice web application."
#define SmartKartUrl "https://qa.smartkart.app"
#define SmartKartShortcutName "SmartKart BackOffice"

[Setup]
AppId={{C1A2D3E4-F5B6-7890-ABCD-1234567890AB}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\BackOffice Print Agent
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=BackOfficePrintAgentSetup-{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
WizardStyle=modern
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}
CloseApplications=force
RestartIfNeededByRun=no
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\publish\BackOfficePrintAgent.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\publish\SumatraPDF.exe"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\publish\appsettings.json"; DestDir: "{app}"; Flags: ignoreversion onlyifdoesntexist
Source: "..\publish\appsettings.Development.json"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist onlyifdoesntexist
Source: "LaunchSmartKart.vbs"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{commonappdata}\BackOfficePrintAgent"; Permissions: users-modify
Name: "{commonappdata}\BackOfficePrintAgent\logs"; Permissions: users-modify

[Icons]
; Desktop + Start Menu shortcuts that launch Chrome with Local Network Access
; enforcement disabled, so qa.smartkart.app can call the local Print Helper on
; https://localhost:9443 without the loopback-access permission prompt.
Name: "{commondesktop}\{#SmartKartShortcutName}"; \
  Filename: "{sys}\wscript.exe"; \
  Parameters: """{app}\LaunchSmartKart.vbs"" ""{#SmartKartUrl}"""; \
  IconFilename: "{app}\{#MyAppExeName}"; \
  Comment: "Open SmartKart BackOffice with print helper enabled"
Name: "{commonprograms}\{#SmartKartShortcutName}"; \
  Filename: "{sys}\wscript.exe"; \
  Parameters: """{app}\LaunchSmartKart.vbs"" ""{#SmartKartUrl}"""; \
  IconFilename: "{app}\{#MyAppExeName}"; \
  Comment: "Open SmartKart BackOffice with print helper enabled"

[Run]
; Offer to launch SmartKart in the LNA-disabled Chrome window right after install.
Filename: "{sys}\wscript.exe"; \
  Parameters: """{app}\LaunchSmartKart.vbs"" ""{#SmartKartUrl}"""; \
  Description: "Open {#SmartKartShortcutName} now"; \
  Flags: postinstall nowait skipifsilent unchecked

[Code]
var
  AccountTypePage: TInputOptionWizardPage;
  CredsPage: TInputQueryWizardPage;

const
  ACCOUNT_LOCAL_SYSTEM = 0;
  ACCOUNT_RUN_AS_USER = 1;

function ShellExecAndWait(const Cmd, Params: String): Integer;
var
  ResultCode: Integer;
begin
  Result := -1;
  if Exec(Cmd, Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    Result := ResultCode;
end;

procedure StopAndDeleteExistingService();
var
  ResultCode: Integer;
begin
  Log('Stopping existing service if present...');
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop {#MyServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1500);
  Exec(ExpandConstant('{sys}\sc.exe'), 'delete {#MyServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1000);
end;

// --- Chrome / Edge enterprise policy: pre-grant "Insecure Private Network Requests" ----------
// Chrome 117+ requires user permission for public HTTPS sites to call into loopback / private
// addresses (Local Network Access). This installer drops a per-app entry into the browser's
// enterprise policy list so the BackOffice web app can reach the local Print Helper without
// the end user touching any Chrome settings.
//
// We use the value name 'BackOfficePrintAgent' so uninstall can remove only our entry without
// disturbing other apps' policy entries. Chrome and Edge read all REG_SZ values in this list
// subkey regardless of value name.

function FindOrAllocateSlot(const PolicyKey, Origin: String): Integer;
var
  i: Integer;
  Existing: String;
begin
  // Search for our origin already in slots 1..50. If found, reuse that slot.
  for i := 1 to 50 do
  begin
    if RegQueryStringValue(HKEY_LOCAL_MACHINE, PolicyKey, IntToStr(i), Existing) then
    begin
      if CompareText(Existing, Origin) = 0 then
      begin
        Result := i;
        Exit;
      end;
    end;
  end;
  // Not present — find first empty slot.
  for i := 1 to 50 do
  begin
    if not RegValueExists(HKEY_LOCAL_MACHINE, PolicyKey, IntToStr(i)) then
    begin
      Result := i;
      Exit;
    end;
  end;
  Result := 0;
end;

procedure SetBrowserPolicyForOrigin(const PolicyRoot, Origin: String);
var
  ResultCode, Slot: Integer;
  PolicyKey, MarkerKey: String;
begin
  PolicyKey := PolicyRoot + '\InsecurePrivateNetworkRequestsAllowedForUrls';
  Slot := FindOrAllocateSlot(PolicyKey, Origin);
  if Slot = 0 then
  begin
    Log('No free slot 1..50 in ' + PolicyKey + '; skipping.');
    Exit;
  end;

  if RegWriteStringValue(HKEY_LOCAL_MACHINE, PolicyKey, IntToStr(Slot), Origin) then
  begin
    Log('Wrote browser policy: ' + PolicyKey + '\' + IntToStr(Slot) + ' -> ' + Origin);
    // Remember which slot we own so uninstall removes only ours.
    MarkerKey := PolicyRoot + '\BackOfficePrintAgent.Markers';
    RegWriteStringValue(HKEY_LOCAL_MACHINE, MarkerKey, Origin, IntToStr(Slot));
  end
  else
    Log('Failed to write browser policy: ' + PolicyKey);

  // Signal browsers to reload policy (managed installs only; no-op otherwise).
  Exec(ExpandConstant('{sys}\gpupdate.exe'), '/force /target:computer', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure InstallBrowserPolicies();
var
  Origin: String;
begin
  // Add every public origin that should be allowed to reach the local agent.
  // Keep this list in sync with PrintAgent's appsettings.json -> Agent.AllowedOrigins.
  Origin := 'https://qa.smartkart.app';
  SetBrowserPolicyForOrigin('SOFTWARE\Policies\Google\Chrome', Origin);
  SetBrowserPolicyForOrigin('SOFTWARE\Policies\Microsoft\Edge', Origin);
end;

// --- Keep the installed appsettings.json AllowedOrigins in sync on upgrade -------------------
// The [Files] entry for appsettings.json uses 'onlyifdoesntexist' so we never clobber a config an
// admin may have customized (service account, extra origins, etc.). The downside is that an
// existing install never picks up NEW origins we ship. This routine bridges that gap: after the
// files are copied, it ensures each required public origin is present in the installed config,
// inserting only the ones that are missing. Non-destructive — existing lines are left untouched.
procedure EnsureAllowedOrigin(const Origin: String);
var
  ConfigPath: String;
  Lines: TArrayOfString;
  i, AnchorIdx, Count: Integer;
begin
  ConfigPath := ExpandConstant('{app}\appsettings.json');
  if not LoadStringsFromFile(ConfigPath, Lines) then
  begin
    Log('EnsureAllowedOrigin: could not read ' + ConfigPath);
    Exit;
  end;

  AnchorIdx := -1;
  for i := 0 to GetArrayLength(Lines) - 1 do
  begin
    // Already present anywhere in the file — nothing to do.
    if Pos(Origin, Lines[i]) > 0 then
    begin
      Log('EnsureAllowedOrigin: ' + Origin + ' already present');
      Exit;
    end;
    // Anchor = the "AllowedOrigins": [ line. Require an opening bracket but NOT a
    // closing one on the same line, so we don't try to inject into an inline "[]".
    if (AnchorIdx = -1) and (Pos('"AllowedOrigins"', Lines[i]) > 0)
       and (Pos('[', Lines[i]) > 0) and (Pos(']', Lines[i]) = 0) then
      AnchorIdx := i;
  end;

  if AnchorIdx = -1 then
  begin
    Log('EnsureAllowedOrigin: AllowedOrigins anchor not found; skipping ' + Origin);
    Exit;
  end;

  // Grow the array by one and shift everything after the anchor down, then drop the
  // new origin line immediately after the "AllowedOrigins": [ line.
  Count := GetArrayLength(Lines);
  SetArrayLength(Lines, Count + 1);
  for i := Count downto AnchorIdx + 2 do
    Lines[i] := Lines[i - 1];
  Lines[AnchorIdx + 1] := '      "' + Origin + '",';

  if SaveStringsToUTF8File(ConfigPath, Lines, False) then
    Log('EnsureAllowedOrigin: added ' + Origin + ' to ' + ConfigPath)
  else
    Log('EnsureAllowedOrigin: FAILED to write ' + ConfigPath);
end;

procedure EnsureAllowedOrigins();
begin
  // Keep this list in sync with PrintAgent's appsettings.json -> Agent.AllowedOrigins
  // and InstallBrowserPolicies above.
  EnsureAllowedOrigin('{#SmartKartUrl}');
end;

procedure RestartAgentService();
var
  ResultCode: Integer;
begin
  // CreateService already started the service before the config was patched. Restart so the
  // updated AllowedOrigins take effect (the agent reads appsettings.json at startup).
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop {#MyServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(1500);
  Exec(ExpandConstant('{sys}\sc.exe'), 'start {#MyServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure RemoveBrowserPolicyForOrigin(const PolicyRoot, Origin: String);
var
  PolicyKey, MarkerKey, SlotStr, CurrentValue: String;
begin
  MarkerKey := PolicyRoot + '\BackOfficePrintAgent.Markers';
  if not RegQueryStringValue(HKEY_LOCAL_MACHINE, MarkerKey, Origin, SlotStr) then Exit;

  PolicyKey := PolicyRoot + '\InsecurePrivateNetworkRequestsAllowedForUrls';
  // Only remove the slot if it still holds our origin (avoid deleting another app's value).
  if RegQueryStringValue(HKEY_LOCAL_MACHINE, PolicyKey, SlotStr, CurrentValue) then
  begin
    if CompareText(CurrentValue, Origin) = 0 then
      RegDeleteValue(HKEY_LOCAL_MACHINE, PolicyKey, SlotStr);
  end;
  RegDeleteValue(HKEY_LOCAL_MACHINE, MarkerKey, Origin);
end;

procedure RemoveBrowserPolicies();
var
  Origin: String;
begin
  Origin := 'https://qa.smartkart.app';
  RemoveBrowserPolicyForOrigin('SOFTWARE\Policies\Google\Chrome', Origin);
  RemoveBrowserPolicyForOrigin('SOFTWARE\Policies\Microsoft\Edge', Origin);
end;

procedure GrantLogonAsServiceRight(const Account: String);
var
  TempInf, TempSdb: String;
  ResultCode: Integer;
  Lines: TArrayOfString;
  i: Integer;
  Found: Boolean;
  Sid, NewLine: String;
begin
  TempInf := ExpandConstant('{tmp}\svcrights.inf');
  TempSdb := ExpandConstant('{tmp}\svcrights.sdb');

  if not Exec(ExpandConstant('{sys}\secedit.exe'),
    '/export /areas USER_RIGHTS /cfg "' + TempInf + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('secedit export failed; skipping logon-as-service grant');
    Exit;
  end;

  if not LoadStringsFromFile(TempInf, Lines) then Exit;

  Sid := '*S-1-0-0';
  Found := False;
  for i := 0 to GetArrayLength(Lines) - 1 do
  begin
    if Pos('SeServiceLogonRight', Lines[i]) = 1 then
    begin
      if Pos(Account, Lines[i]) = 0 then
        Lines[i] := Lines[i] + ',' + Account;
      Found := True;
      Break;
    end;
  end;

  if not Found then
  begin
    NewLine := 'SeServiceLogonRight = ' + Account;
    SetArrayLength(Lines, GetArrayLength(Lines) + 1);
    Lines[GetArrayLength(Lines) - 1] := NewLine;
  end;

  SaveStringsToUTF8File(TempInf, Lines, False);
  Exec(ExpandConstant('{sys}\secedit.exe'),
    '/configure /db "' + TempSdb + '" /cfg "' + TempInf + '" /areas USER_RIGHTS',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  DeleteFile(TempInf);
  DeleteFile(TempSdb);
end;

procedure CreateService();
var
  ExePath, BinArg, ObjArg, PwdArg, FullArgs, User, Pwd: String;
  AccountType: Integer;
  ResultCode: Integer;
begin
  ExePath := ExpandConstant('{app}\{#MyAppExeName}');
  BinArg := 'binPath= "' + ExePath + '" start= auto DisplayName= "{#MyServiceDisplay}"';
  AccountType := AccountTypePage.SelectedValueIndex;

  if AccountType = ACCOUNT_RUN_AS_USER then
  begin
    User := CredsPage.Values[0];
    Pwd := CredsPage.Values[1];
    if Pos('\', User) = 0 then User := '.\' + User;
    GrantLogonAsServiceRight(User);
    ObjArg := 'obj= "' + User + '"';
    PwdArg := ' password= "' + Pwd + '"';
    Log('Creating service as user ' + User);
  end else
  begin
    ObjArg := 'obj= LocalSystem';
    PwdArg := '';
    Log('Creating service as LocalSystem');
  end;

  FullArgs := 'create {#MyServiceName} ' + BinArg + ' ' + ObjArg + PwdArg;
  if Exec(ExpandConstant('{sys}\sc.exe'), FullArgs, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    Log('sc create returned ' + IntToStr(ResultCode))
  else
    Log('sc create failed to launch');

  Exec(ExpandConstant('{sys}\sc.exe'),
    'description {#MyServiceName} "{#MyServiceDescription}"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\sc.exe'),
    'failure {#MyServiceName} reset= 86400 actions= restart/5000/restart/15000/restart/60000',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(ExpandConstant('{sys}\sc.exe'),
    'failureflag {#MyServiceName} 1',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  if AccountType = ACCOUNT_RUN_AS_USER then
  begin
    Exec(ExpandConstant('{sys}\icacls.exe'),
      ExpandConstant('"{commonappdata}\BackOfficePrintAgent" /grant "') + User + ':(OI)(CI)M" /T',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;

  Exec(ExpandConstant('{sys}\sc.exe'), 'start {#MyServiceName}', '',
    SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure InitializeWizard();
begin
  AccountTypePage := CreateInputOptionPage(wpSelectDir,
    'Service Account',
    'How should the print agent run?',
    'The agent runs as a Windows service. Pick the account it runs under.' + #13#10 + #13#10 +
    'LocalSystem is fine for most printers installed system-wide.' + #13#10 + #13#10 +
    'Run as a specific user is required for: HP Universal Printing PS, USB printers using DOT4 ports, ' +
    'network printers that need user credentials, and any printer added under a single user profile.',
    True, False);
  AccountTypePage.Add('LocalSystem (default)');
  AccountTypePage.Add('Run as a specific user account (recommended for HP / per-user printers)');
  AccountTypePage.SelectedValueIndex := 0;

  CredsPage := CreateInputQueryPage(AccountTypePage.ID,
    'Service Account Credentials',
    'Enter the user that will run the print service',
    'The user account must have the printer installed in its profile. ' +
    'The password is stored only by Windows Service Control Manager (LSA secrets), never on disk.');
  CredsPage.Add('Username (e.g. .\Faisal or DOMAIN\Faisal):', False);
  CredsPage.Add('Password:', True);
  CredsPage.Values[0] := '.\' + ExpandConstant('{username}');
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if (PageID = CredsPage.ID) and (AccountTypePage.SelectedValueIndex = ACCOUNT_LOCAL_SYSTEM) then
    Result := True;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = CredsPage.ID) and (AccountTypePage.SelectedValueIndex = ACCOUNT_RUN_AS_USER) then
  begin
    if Trim(CredsPage.Values[0]) = '' then
    begin
      MsgBox('Username is required.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if Trim(CredsPage.Values[1]) = '' then
    begin
      MsgBox('Password is required.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  case CurStep of
    ssInstall:
      StopAndDeleteExistingService();
    ssPostInstall:
    begin
      CreateService();
      // Patch any missing required origins into an existing (un-overwritten) config,
      // then restart so the agent reloads AllowedOrigins.
      EnsureAllowedOrigins();
      RestartAgentService();
      InstallBrowserPolicies();
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    Log('Stopping and deleting service...');
    Exec(ExpandConstant('{sys}\sc.exe'), 'stop {#MyServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(1500);
    Exec(ExpandConstant('{sys}\sc.exe'), 'delete {#MyServiceName}', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    RemoveBrowserPolicies();
  end;
end;
