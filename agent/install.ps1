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
  "index.js" = "7FC370E9DC90A06258C33E6CE01F4A9886EE0395B1BC103BF6BE9468C590912F"
  "executor.js" = "AD649C86DADEBB658AD217E2906B0DC4E87F0A3AD817FC28B44462F6586CB1AF"
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

# Generate a launcher that binds the agent to this workspace without changing machine policy.
$escapedWorkspace = $workspace.Replace("'", "''")
$launcher = @"
`$ErrorActionPreference = 'Stop'
`$env:DEVFORGE_WORKSPACE = '$escapedWorkspace'
Set-Location -LiteralPath `$PSScriptRoot
node (Join-Path `$PSScriptRoot 'src\index.js')
"@
$launcherPath = Join-Path $installRoot "Start-DevForgeAgent.ps1"
Set-Content -LiteralPath $launcherPath -Value $launcher -Encoding utf8

Write-Host ""
Write-Host "DevForge Local Agent installed without cloning the DevForge application."
Write-Host "Agent files: $installRoot"
Write-Host "Workspace:   $workspace"
Write-Host ""
Write-Host "Start the agent with:"
Write-Host "powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$launcherPath'"
