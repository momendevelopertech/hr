param(
    [switch]$Restart
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$apiDir = Join-Path $repoRoot 'apps\api'
$webDir = Join-Path $repoRoot 'apps\web'
$logDir = Join-Path (Join-Path $repoRoot '.codex-logs') 'local-run'
$apiStdout = Join-Path $logDir 'api-stdout.log'
$apiStderr = Join-Path $logDir 'api-stderr.log'
$webStdout = Join-Path $logDir 'web-stdout.log'
$webStderr = Join-Path $logDir 'web-stderr.log'
$whatsAppScript = Join-Path $PSScriptRoot 'start-whatsapp-service.ps1'

function Test-ListeningPort {
    param([int]$Port)

    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Wait-ForPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-ListeningPort -Port $Port) {
            return $true
        }

        Start-Sleep -Seconds 3
    }

    return $false
}

function Resolve-LogPath {
    param([string]$Path)

    $directory = Split-Path -Parent $Path
    if ($directory) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    if (-not (Test-Path $Path)) {
        return $Path
    }

    try {
        Remove-Item $Path -Force
        return $Path
    } catch {
        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($Path)
        $extension = [System.IO.Path]::GetExtension($Path)
        return Join-Path $directory "$baseName-$timestamp$extension"
    }
}

function Stop-ProcessesListeningOnPort {
    param([int]$Port)

    Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object {
            if ($_ -and $_ -gt 0) {
                Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
            }
        }
}

function Start-ApiServer {
    if (Test-ListeningPort -Port 3001) {
        return
    }

    $script:apiStdout = Resolve-LogPath -Path $apiStdout
    $script:apiStderr = Resolve-LogPath -Path $apiStderr

    Start-Process `
        -FilePath 'cmd.exe' `
        -ArgumentList '/c', 'set DISABLE_REDIS=1&& npm.cmd run start' `
        -WorkingDirectory $apiDir `
        -RedirectStandardOutput $apiStdout `
        -RedirectStandardError $apiStderr | Out-Null

    if (-not (Wait-ForPort -Port 3001 -TimeoutSeconds 90)) {
        throw "API did not start on port 3001. Check $apiStdout and $apiStderr"
    }
}

function Start-WebServer {
    if (Test-ListeningPort -Port 3000) {
        return
    }

    $script:webStdout = Resolve-LogPath -Path $webStdout
    $script:webStderr = Resolve-LogPath -Path $webStderr

    Start-Process `
        -FilePath 'cmd.exe' `
        -ArgumentList '/c', 'npm.cmd run dev' `
        -WorkingDirectory $webDir `
        -RedirectStandardOutput $webStdout `
        -RedirectStandardError $webStderr | Out-Null

    if (-not (Wait-ForPort -Port 3000 -TimeoutSeconds 120)) {
        throw "Web app did not start on port 3000. Check $webStdout and $webStderr"
    }
}

if (-not (Test-Path $whatsAppScript)) {
    throw "WhatsApp startup script was not found: $whatsAppScript"
}

if ($Restart) {
    Stop-ProcessesListeningOnPort -Port 3000
    Stop-ProcessesListeningOnPort -Port 3001
    Start-Sleep -Seconds 2
}

Write-Host 'Starting WhatsApp stack...' -ForegroundColor Cyan
if ($Restart) {
    & $whatsAppScript -Restart
} else {
    & $whatsAppScript
}

if ($Restart -or -not (Test-ListeningPort -Port 3001)) {
    Write-Host ''
    Write-Host 'Building API...' -ForegroundColor Cyan
    Push-Location $apiDir
    try {
        & cmd.exe /c 'npm.cmd run build' | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "API build failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host ''
    Write-Host 'API is already running, skipping rebuild.' -ForegroundColor DarkGray
}

Write-Host ''
Write-Host 'Starting API...' -ForegroundColor Cyan
Start-ApiServer

Write-Host ''
Write-Host 'Starting web app...' -ForegroundColor Cyan
Start-WebServer

Write-Host ''
[pscustomobject]@{
    ApiUrl = 'http://127.0.0.1:3001/api'
    WebUrl = 'http://127.0.0.1:3000'
    Swagger = 'http://127.0.0.1:3001/api/docs'
    WhatsAppBridge = 'http://127.0.0.1:8080/__bridge/health'
    EvolutionManager = 'http://127.0.0.1:8081/manager'
    ApiStdoutLog = $apiStdout
    ApiStderrLog = $apiStderr
    WebStdoutLog = $webStdout
    WebStderrLog = $webStderr
} | Format-List

Write-Host ''
Write-Host 'Local HR stack is ready.' -ForegroundColor Green
