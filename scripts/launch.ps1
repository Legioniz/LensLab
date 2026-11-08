$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogDirectory = Join-Path $ProjectRoot 'logs'
$LauncherLog = Join-Path $LogDirectory 'launcher.log'
$ServerLog = Join-Path $LogDirectory 'app-server.log'
$PortPreference = Join-Path $LogDirectory 'app-port.txt'
$ServerProcess = $null
$ReusedExisting = $false
$TranscriptStarted = $false
$TranscriptLog = Join-Path $LogDirectory 'launcher-transcript.log'

try {
  New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
} catch {
  Write-Host "Cannot create the LENS LAB log folder at $LogDirectory. Extract the project to a writable folder." -ForegroundColor Red
  exit 1
}
try { Start-Transcript -Path $TranscriptLog -Append | Out-Null; $TranscriptStarted = $true } catch { Write-Host 'Warning: PowerShell transcript could not start; launcher errors will still be shown on screen.' -ForegroundColor Yellow }

function Write-Step([string]$Message) { Write-Host "`n[LENS LAB] $Message" -ForegroundColor Cyan }
function Write-LogText([string]$Message) {
  try { Add-Content -LiteralPath $LauncherLog -Value "[$(Get-Date -Format o)] $Message" -Encoding UTF8 } catch { Write-Host "[LOG WARNING] Could not append launcher log: $($_.Exception.Message)" -ForegroundColor Yellow }
}
function Invoke-NpmCommand([string[]]$Arguments) {
  # Windows PowerShell 5.1 can turn native stderr into terminating ErrorRecords
  # when ErrorActionPreference=Stop. Temporarily use Continue so npm's exit code
  # and full diagnostics can be captured and handled deliberately.
  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $output = @(& npm.cmd @Arguments 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  return [pscustomobject]@{ ExitCode = [int]$exitCode; Output = [string[]]$output }
}
function Show-NpmOutput($Result) {
  if ($Result.Output -and $Result.Output.Count -gt 0) {
    $Result.Output | ForEach-Object { Write-Host "  $_" }
    Write-LogText ($Result.Output -join [Environment]::NewLine)
  }
}
function Write-Ok([string]$Message) { Write-Host "  [OK] $Message" -ForegroundColor Green }
function Refresh-ProcessPath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user;$env:ProgramFiles\nodejs;$env:LOCALAPPDATA\Programs\nodejs"
}
function Get-NodeVersion {
  $command = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $command) { return $null }
  try { return [version]((& node.exe -p "process.versions.node").Trim()) } catch { return $null }
}
function Test-NodeVersion([version]$Version) {
  if ($null -eq $Version) { return $false }
  return (($Version.Major -eq 22 -and $Version.Minor -ge 12) -or $Version.Major -eq 24 -or ($Version.Major -eq 26))
}
function Install-NodeLts {
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if ($winget) {
    Write-Step 'Trying Windows Package Manager for the official Node.js LTS package.'
    try {
      & winget.exe install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
      Refresh-ProcessPath
      $version = Get-NodeVersion
      if ((Test-NodeVersion $version) -and (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { Write-Ok "Node.js $version and npm installed through winget."; return }
      Write-Host 'winget completed but a compatible runtime is not visible yet; using the official MSI fallback.' -ForegroundColor Yellow
    } catch { Write-Host "winget fallback: $($_.Exception.Message)" -ForegroundColor Yellow }
  }

  Write-Step 'Retrieving current LTS release metadata from nodejs.org.'
  $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -TimeoutSec 45
  $nativeArch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
  $arch = if ($nativeArch -match 'ARM64') { 'arm64' } else { 'x64' }
  $fileName = "win-$arch-msi"
  $release = $index | Where-Object { $_.lts -and $_.files -contains $fileName } | Select-Object -First 1
  if (-not $release) { throw "No current LTS MSI was found for Windows architecture $arch." }

  $versionTag = $release.version
  $msiName = "node-$versionTag-$arch.msi"
  $baseUrl = "https://nodejs.org/dist/$versionTag"
  $msiPath = Join-Path $env:TEMP $msiName
  $sumsPath = Join-Path $env:TEMP "node-$versionTag-SHASUMS256.txt"
  Write-Step "Downloading Node.js $versionTag ($arch) from nodejs.org."
  Invoke-WebRequest -Uri "$baseUrl/$msiName" -OutFile $msiPath -TimeoutSec 240
  Invoke-WebRequest -Uri "$baseUrl/SHASUMS256.txt" -OutFile $sumsPath -TimeoutSec 60
  $expectedLine = Get-Content $sumsPath | Where-Object { $_ -match "\s+$([regex]::Escape($msiName))$" } | Select-Object -First 1
  if (-not $expectedLine) { throw 'The official checksum file did not contain the downloaded MSI filename.' }
  $expectedHash = ($expectedLine -split '\s+')[0].ToUpperInvariant()
  $actualHash = (Get-FileHash -Path $msiPath -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($actualHash -ne $expectedHash) { Remove-Item $msiPath -Force; throw 'Node.js installer SHA-256 verification failed. The installer was deleted.' }
  Write-Ok 'Official Node.js MSI checksum verified.'

  Write-Step 'Starting the signed Windows MSI installer. Windows may request administrator approval.'
  $install = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', "`"$msiPath`"", '/qn', '/norestart') -Verb RunAs -Wait -PassThru
  Remove-Item $msiPath, $sumsPath -Force -ErrorAction SilentlyContinue
  if ($install.ExitCode -ne 0) { throw "Node.js MSI exited with code $($install.ExitCode)." }
  Refresh-ProcessPath
}
function Test-Port([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $task = $client.BeginConnect('127.0.0.1', $Port, $null, $null); return $task.AsyncWaitHandle.WaitOne(250) -and $client.Connected }
  catch { return $false }
  finally { $client.Close() }
}
function Get-AvailablePort {
  if (Test-Path $PortPreference) {
    try {
      $preferred = [int]((Get-Content $PortPreference -Raw).Trim())
      if ($preferred -ge 5173 -and $preferred -le 5190 -and -not (Test-Port $preferred)) { return $preferred }
    } catch { }
  }
  foreach ($port in 5173..5190) { if (-not (Test-Port $port)) { return $port } }
  throw 'No available local application port was found between 5173 and 5190.'
}
function Get-ExistingLensLabUrl([string]$Version) {
  foreach ($port in 5173..5190) {
    if (Test-Port $port) {
      try {
        $candidate = "http://127.0.0.1:$port"
        $response = Invoke-WebRequest -Uri $candidate -TimeoutSec 2 -UseBasicParsing
        if ($response.StatusCode -eq 200 -and $response.Content -match ('<meta\s+name="lens-lab-version"\s+content="' + [regex]::Escape($Version) + '"')) { return $candidate }
      } catch { }
    }
  }
  return $null
}

try {
  Write-Host '============================================================' -ForegroundColor DarkCyan
  Write-Host ' LENS LAB 0.5.0  |  LOCAL PHOTOGRAPHY SIMULATION STUDIO' -ForegroundColor White
  Write-Host '============================================================' -ForegroundColor DarkCyan

  Write-Step 'Checking operating system and project files.'
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'This one-click launcher is for Windows. See docs/USER-GUIDE.md for macOS/Linux instructions.' }
  $osVersion = [Environment]::OSVersion.Version
  if ($osVersion.Major -lt 10 -or ($osVersion.Major -eq 10 -and $osVersion.Build -lt 10240)) { throw 'Windows 10 or later is required for this launcher.' }
  if ($PSVersionTable.PSVersion -lt [version]'5.1') { throw 'Windows PowerShell 5.1 or later is required.' }
  $nativeArch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
  if ($nativeArch -notmatch 'AMD64|ARM64') { throw "A supported 64-bit Windows architecture is required. Detected: $nativeArch" }
  foreach ($required in @('package.json', 'index.html', 'src/main.tsx', 'vite.config.ts')) {
    if (-not (Test-Path (Join-Path $ProjectRoot $required))) { throw "Required project file is missing: $required. Re-extract the complete ZIP archive." }
  }
  $drive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($ProjectRoot))
  if ($drive.AvailableFreeSpace -lt 1GB) { throw 'At least 1 GB of free disk space is required for dependencies, builds, and image processing.' }
  Write-Ok "Windows $($osVersion.Build), $nativeArch, project structure, and disk-space checks passed."

  Write-Step 'Checking Node.js and npm requirements.'
  $nodeVersion = Get-NodeVersion
  $npmInitiallyAvailable = [bool](Get-Command npm.cmd -ErrorAction SilentlyContinue)
  if (-not (Test-NodeVersion $nodeVersion) -or -not $npmInitiallyAvailable) {
    Write-Host 'A compatible Node.js LTS runtime is missing or too old.' -ForegroundColor Yellow
    Install-NodeLts
    $nodeVersion = Get-NodeVersion
  } else { Write-Ok "Compatible Node.js $nodeVersion found; skipping runtime installation." }
  if (-not (Test-NodeVersion $nodeVersion)) { throw 'Node.js installation did not provide a compatible runtime. Install Node.js 22.12+, 24.x, or 26.x LTS and launch again.' }

  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCommand) { throw 'npm.cmd is missing. Repair the Node.js installation and relaunch.' }
  $npmVersionResult = Invoke-NpmCommand @('--version')
  if ($npmVersionResult.ExitCode -ne 0) { Show-NpmOutput $npmVersionResult; throw 'npm exists but could not run. Repair Node.js and relaunch.' }
  $npmVersion = ($npmVersionResult.Output -join '').Trim()
  Write-Ok "Node.js $nodeVersion and npm $npmVersion are available."

  Push-Location $ProjectRoot
  try {
    Write-Step 'Checking project dependencies.'
    $packageManifest = Get-Content (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json
    $projectVersion = [string]$packageManifest.version
    $lockfilePath = Join-Path $ProjectRoot 'package-lock.json'
    $lockfileCompatible = $true
    if (-not (Test-Path $lockfilePath)) {
      $lockfileCompatible = $false
      Write-LogText 'package-lock.json is missing. npm install will create a reproducible lockfile while reconciling the exact direct package versions.'
    }
    if (Test-Path $lockfilePath) {
      try {
        # Node handles npm's empty-string root key consistently on both PowerShell 5.1 and 7+.
        $lockVersionOutput = @(& node.exe -p "JSON.parse(require('fs').readFileSync('package-lock.json','utf8')).version" 2>&1)
        $lockParseExitCode = $LASTEXITCODE
        if ($lockParseExitCode -ne 0) {
          throw "Node could not parse package-lock.json: $($lockVersionOutput -join ' ')"
        }
        $lockRootVersion = [string]($lockVersionOutput -join '').Trim()
        if (-not $lockRootVersion) { throw 'The package-lock.json root version is missing.' }
        if ($lockRootVersion -ne $projectVersion) {
          $lockfileCompatible = $false
          Write-LogText "Existing package-lock.json belongs to version $lockRootVersion; package.json is $projectVersion. npm install will reconcile the lockfile without blindly deleting installed dependencies."
        }
      } catch {
        $lockfileCompatible = $false
        Write-LogText "Existing package-lock.json could not be validated: $($_.Exception.Message). npm install will regenerate a valid lockfile."
      }
    }

    $dependencyCheck = Invoke-NpmCommand @('ls', '--depth=0')
    if ($dependencyCheck.ExitCode -eq 0 -and $lockfileCompatible) {
      Write-Ok 'All direct dependencies are present and the lockfile is compatible; skipping dependency installation.'
      Show-NpmOutput $dependencyCheck
    } else {
      Write-Host 'Dependencies or lockfile are missing or inconsistent. Repairing the dependency tree...' -ForegroundColor Yellow
      Show-NpmOutput $dependencyCheck
      if ((Test-Path $lockfilePath) -and $lockfileCompatible) {
        Write-Step 'A compatible package-lock.json exists; running reproducible npm ci.'
        $installResult = Invoke-NpmCommand @('ci', '--no-audit', '--no-fund')
      } else {
        Write-Step 'Installing the exact direct versions from package.json and reconciling/generating package-lock.json.'
        $installResult = Invoke-NpmCommand @('install', '--no-audit', '--no-fund')
      }
      Show-NpmOutput $installResult
      if ($installResult.ExitCode -ne 0) { throw "Dependency repair failed with npm exit code $($installResult.ExitCode). Check internet access and logs/launcher.log." }
      $dependencyCheck = Invoke-NpmCommand @('ls', '--depth=0')
      Show-NpmOutput $dependencyCheck
      if ($dependencyCheck.ExitCode -ne 0) { throw "npm still reports an invalid dependency tree (exit $($dependencyCheck.ExitCode)) after repair. See the complete npm output in logs/launcher.log." }
      Write-Ok 'Dependencies installed and verified.'
    }

    Write-Step 'Running type checks, unit tests, and the production build.'
    $verifyResult = Invoke-NpmCommand @('run', 'verify')
    Show-NpmOutput $verifyResult
    if ($verifyResult.ExitCode -ne 0) { throw "Verification failed with npm exit code $($verifyResult.ExitCode). Review the first TypeScript/test/build error in logs/launcher.log." }
    Write-Ok 'Type check, test suite, and production build passed.'

    $url = Get-ExistingLensLabUrl $projectVersion
    if ($url) {
      $ReusedExisting = $true
      Set-Content -Path $PortPreference -Value ([uri]$url).Port -NoNewline
      Write-Ok "An existing LENS LAB $projectVersion server is already responding at $url; reusing it."
    } else {
      $port = Get-AvailablePort
      Set-Content -Path $PortPreference -Value $port -NoNewline
      $url = "http://127.0.0.1:$port"
      Write-Step "Starting the local application on $url."
      if (Test-Path $ServerLog) { Add-Content -Path $ServerLog -Value "`n--- $(Get-Date -Format o) NEW START ---" }
      $commandLine = "/c npm.cmd run preview -- --host 127.0.0.1 --port $port --strictPort >> `"$ServerLog`" 2>&1"
      $ServerProcess = Start-Process -FilePath $env:ComSpec -ArgumentList $commandLine -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru

      $ready = $false
      for ($attempt = 0; $attempt -lt 50; $attempt++) {
        Start-Sleep -Milliseconds 400
        if ($ServerProcess.HasExited) { break }
        try {
          $response = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing
          if ($response.StatusCode -eq 200 -and $response.Content -match ('<meta\s+name="lens-lab-version"\s+content="' + [regex]::Escape($projectVersion) + '"')) { $ready = $true; break }
        } catch { }
      }
      if (-not $ready) {
        $tail = if (Test-Path $ServerLog) { (Get-Content $ServerLog -Tail 30) -join "`n" } else { 'No application server output was recorded.' }
        throw "The local server did not become ready. Server output:`n$tail"
      }
    }
    try { Start-Process $url -ErrorAction Stop } catch { Write-Host "Browser auto-open failed. Open $url manually." -ForegroundColor Yellow }
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '                 DONE PROCESSING' -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host "LENS LAB is running at: $url" -ForegroundColor White
    Write-Host "Launcher log: $LauncherLog" -ForegroundColor Gray
    Write-Host "App log:      $ServerLog" -ForegroundColor Gray
    if ($ReusedExisting) {
      Write-Host 'Press ENTER to close this launcher. The existing server will remain running.' -ForegroundColor Gray
    } else {
      Write-Host 'Keep this launcher window open. Press ENTER here to stop LENS LAB.' -ForegroundColor Gray
    }
    [void](Read-Host)
  } finally { Pop-Location }
} catch {
  Write-Host "`n[LENS LAB ERROR] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Review: $LauncherLog" -ForegroundColor Yellow
  Write-LogText "FATAL: $($_.Exception.ToString())"
  if ($ServerProcess -and -not $ServerProcess.HasExited) { & taskkill.exe /PID $ServerProcess.Id /T /F 2>$null | Out-Null }
  exit 1
} finally {
  if ($ServerProcess -and -not $ServerProcess.HasExited) { & taskkill.exe /PID $ServerProcess.Id /T /F 2>$null | Out-Null }
  if ($TranscriptStarted) { try { Stop-Transcript | Out-Null } catch { } }
}
