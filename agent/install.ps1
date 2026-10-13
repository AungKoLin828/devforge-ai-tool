param(
  [string]$WorkspacePath = (Join-Path $HOME "DevForge")
)

$ErrorActionPreference = "Stop"

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
$expectedHashes = @{
  "index.js" = "0F6C24DE02D7606BDFD2E9C9AA0639BC997891BB759CE96DE923FBB76E172AEE"
  "executor.js" = "D9A9C47A9DC6EF60601EEAA7C417F63C4A1EBD10F5FE271BA50D4508911D02EC"
  "security.js" = "A335E274EA76AEA851B85682F4087A444CD00DB422C816C2368C733B3166043A"
}

New-Item -ItemType Directory -Path $sourceRoot -Force | Out-Null
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
