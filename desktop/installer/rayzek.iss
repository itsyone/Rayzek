; Inno Setup script for Rayzek — builds a proper Windows installer.
; Produces: desktop/installer/Output/rayzek-setup.exe
;
; Installs rayzek.exe to Program Files, creates Start Menu + Desktop shortcuts,
; registers an uninstaller (Add/Remove Programs), and optionally enables
; start-at-logon via a scheduled task that runs elevated (no UAC prompt at boot).

#define AppName "Rayzek"
#define AppVersion "0.1.0"
#define AppPublisher "Rayzek"
#define AppURL "https://github.com/itsyone/Rayzek"
#define AppExe "rayzek.exe"

[Setup]
AppId={{B7E6B3C2-9F4A-4D2E-9C1A-7A1B2C3D4E5F}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
; The app needs Administrator to read all connections, so install to Program Files.
PrivilegesRequired=admin
OutputDir=Output
OutputBaseFilename=rayzek-setup
SetupIconFile=..\rayzek.ico
UninstallDisplayIcon={app}\{#AppExe}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; Close a running instance before installing/uninstalling.
CloseApplications=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Shortcuts:"
Name: "autostart"; Description: "Start Rayzek automatically when I log in"; GroupDescription: "Startup:"; Flags: unchecked

[Files]
Source: "..\..\dist\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
; Optional: register the logon auto-start task (runs elevated, no UAC each boot).
Filename: "schtasks"; \
  Parameters: "/Create /TN RayzekAutostart /TR ""{app}\{#AppExe}"" /SC ONLOGON /RL HIGHEST /F"; \
  Flags: runhidden; Tasks: autostart
; Offer to launch after install. Use shellexec so Windows elevates the app via
; UAC (it requires Administrator); a plain CreateProcess fails with code 740.
Filename: "{app}\{#AppExe}"; Description: "Launch {#AppName} now"; \
  Flags: postinstall skipifsilent shellexec nowait

[UninstallRun]
; Remove the auto-start task on uninstall (ignore errors if it isn't there).
Filename: "schtasks"; Parameters: "/Delete /TN RayzekAutostart /F"; \
  Flags: runhidden; RunOnceId: "DelRayzekAutostart"

[UninstallDelete]
; Leave user data (%LOCALAPPDATA%\Rayzek) in place by default.
Type: dirifempty; Name: "{app}"
