param(
  # Use a workspace owned by the current Windows user unless a custom path is supplied.
  [string]$WorkspacePath = (Join-Path $HOME "DevForge")
)

# Stop on download, validation, filesystem, and launcher-creation errors.
$ErrorActionPreference = "Stop"

# Validate the Node runtime before installing or starting the standalone agent.
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  throw "Node.js 22 LTS or newer is required. Install Node.js, then run this installer again."
}

$nodeVersion = (& node --version).Trim()
if ($nodeVersion -notmatch "^v(\d+)\." -or [int]$Matches[1] -lt 22) {
  throw "Node.js 22 LTS or newer is required. Detected $nodeVersion."
}

$workspace = [System.IO.Path]::GetFullPath($WorkspacePath)
$installRoot = Join-Path $env:LOCALAPPDATA "DevForgeAgent"
$sourceRoot = Join-Path $installRoot "src"
$repository = "https://raw.githubusercontent.com/AungKoLin828/devforge-ai-tool/main/agent/src"
# Pin expected content hashes so a partial or altered download is never installed.
$expectedHashes = @{
  "index.js" = "8EA91B63F4C9EE67F51DFC1B0128A7998E54A9F098060EDE75F551209D11BF3C"
  "executor.js" = "FB1059A897334989321F14A0A841D4EB7C32667400B0909B10AD15DAC1C54151"
  "security.js" = "109A76165151907E8433D4AE2F4B5F45C5FFE8750E0E10E94DC97F78F2BEA864"
}

New-Item -ItemType Directory -Path $sourceRoot -Force | Out-Null
# Probe workspace permissions before reporting a successful install.
try {
  New-Item -ItemType Directory -Path $workspace -Force | Out-Null
  $workspaceProbe = Join-Path $workspace (".devforge-write-check-" + [guid]::NewGuid().ToString("N"))
  [System.IO.File]::WriteAllText($workspaceProbe, "")
  Remove-Item -LiteralPath $workspaceProbe -Force
}
catch {
  if ($workspaceProbe -and (Test-Path -LiteralPath $workspaceProbe)) {
    Remove-Item -LiteralPath $workspaceProbe -Force -ErrorAction SilentlyContinue
  }
  throw "Cannot create or write to workspace '$workspace'. Choose a folder you own, such as '$HOME\DevForge', or create/allow access to the selected folder, then rerun the installer. Original error: $($_.Exception.Message)"
}

foreach ($file in @("index.js", "executor.js", "security.js")) {
  $destination = Join-Path $sourceRoot $file
  $temporaryFile = "$destination.download"
  try {
    # Download to a temporary path and replace the active file only after verification.
    Invoke-WebRequest -Uri "$repository/$file" -OutFile $temporaryFile
    if (-not (Test-Path $temporaryFile) -or (Get-Item $temporaryFile).Length -eq 0) {
      throw "The downloaded Local Agent file '$file' is empty."
    }
    $actualHash = (Get-FileHash -LiteralPath $temporaryFile -Algorithm SHA256).Hash
    if ($actualHash -ne $expectedHashes[$file]) {
      throw "The downloaded Local Agent file '$file' failed its SHA-256 integrity check."
    }
    Move-Item -Path $temporaryFile -Destination $destination -Force
  }
  finally {
    if (Test-Path $temporaryFile) {
      Remove-Item -LiteralPath $temporaryFile -Force
    }
  }
}

# Generate an on-demand background launcher for the installed agent.
$escapedWorkspace = $workspace.Replace("'", "''")
$launcher = @"
`$ErrorActionPreference = 'Stop'
`$mutex = [System.Threading.Mutex]::new(`$false, 'Local\DevForgeAgentStart')
if (-not `$mutex.WaitOne(0)) {
  exit 0
}

try {
  `$tcpClient = New-Object System.Net.Sockets.TcpClient
  try {
    `$tcpClient.Connect('127.0.0.1', 45821)
    exit 0
  }
  catch {
  }
  finally {
    `$tcpClient.Dispose()
  }

  `$node = Get-Command node -ErrorAction Stop
  `$env:DEVFORGE_WORKSPACE = '$escapedWorkspace'
  `$env:DEVFORGE_AGENT_SILENT = '1'
  `$entryPoint = Join-Path `$PSScriptRoot 'src\index.js'
  `$stdout = Join-Path `$PSScriptRoot 'agent.stdout.log'
  `$stderr = Join-Path `$PSScriptRoot 'agent.stderr.log'
  `$agentProcess = Start-Process -FilePath `$node.Source -ArgumentList ('"' + `$entryPoint + '"') -WorkingDirectory `$PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput `$stdout -RedirectStandardError `$stderr -PassThru
  for (`$attempt = 0; `$attempt -lt 40; `$attempt++) {
    `$tcpClient = New-Object System.Net.Sockets.TcpClient
    try {
      `$tcpClient.Connect('127.0.0.1', 45821)
      exit 0
    }
    catch {
      if (`$agentProcess.HasExited) {
        throw 'The Local Agent exited before it started listening.'
      }
      Start-Sleep -Milliseconds 250
    }
    finally {
      `$tcpClient.Dispose()
    }
  }
  throw 'The Local Agent did not start listening within 10 seconds.'
}
finally {
  `$mutex.ReleaseMutex()
  `$mutex.Dispose()
}
"@
$launcherPath = Join-Path $installRoot "Start-DevForgeAgent.ps1"
Set-Content -LiteralPath $launcherPath -Value $launcher -Encoding utf8

# Register a per-user URL handler so a user gesture in DevForge can start the agent.
$protocolKey = "HKCU:\Software\Classes\devforge-agent"
$protocolCommandKey = Join-Path $protocolKey "shell\open\command"
New-Item -Path $protocolCommandKey -Force | Out-Null
New-ItemProperty -Path $protocolKey -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
$powerShellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$protocolCommand = "`"$powerShellPath`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcherPath`" `"%1`""
Set-Item -Path $protocolCommandKey -Value $protocolCommand

Write-Host ""
Write-Host "DevForge Local Agent installed without cloning the DevForge application."
Write-Host "Agent files: $installRoot"
Write-Host "Workspace:   $workspace"
Write-Host ""
Write-Host "The DevForge app will start and pair the agent when you select Start and connect agent or generate a project."
Write-Host "If the browser asks to open DevForge Agent, approve it."
