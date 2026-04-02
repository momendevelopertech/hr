param(
    [switch]$Restart
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$repoEnvPath = Join-Path $repoRoot '.env'
$stackScript = Join-Path $PSScriptRoot 'start-whatsapp-stack.ps1'
$logDir = Join-Path (Join-Path $repoRoot '.codex-logs') 'whatsapp-stack'
$ngrokStdout = Join-Path $logDir 'ngrok-stdout.log'
$ngrokStderr = Join-Path $logDir 'ngrok-stderr.log'

function Get-DotEnvValue {
    param(
        [string]$Path,
        [string]$Key
    )

    if (-not (Test-Path $Path)) {
        return $null
    }

    $escapedKey = [regex]::Escape($Key)
    $line = Get-Content -Path $Path | Where-Object { $_ -match "^\s*$escapedKey\s*=" } | Select-Object -First 1
    if (-not $line) {
        return $null
    }

    $value = $line -replace "^\s*$escapedKey\s*=\s*", ''
    $value = $value.Trim()

    if ($value.Length -ge 2) {
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
    }

    return $value
}

function Test-ListeningPort {
    param([int]$Port)

    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Wait-ForCondition {
    param(
        [scriptblock]$Condition,
        [int]$TimeoutSeconds = 20,
        [int]$PollIntervalSeconds = 2
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (& $Condition) {
            return $true
        }

        Start-Sleep -Seconds $PollIntervalSeconds
    }

    return $false
}

function Stop-NgrokProcesses {
    Get-CimInstance Win32_Process |
        Where-Object { $_.Name -match '^ngrok(\.exe)?$' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Get-NgrokTunnelInfo {
    try {
        $response = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 5
        return $response.tunnels | Select-Object -First 1
    } catch {
        return $null
    }
}

function Start-NgrokTunnel {
    param([string]$PublicUrl)

    if (-not $PublicUrl) {
        return $null
    }

    if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
        throw 'ngrok is not installed or not available on PATH.'
    }

    $normalizedUrl = $PublicUrl.Trim().TrimEnd('/')
    $existingTunnel = Get-NgrokTunnelInfo
    if ($existingTunnel -and $existingTunnel.public_url -eq $normalizedUrl) {
        return $existingTunnel
    }

    New-Item -ItemType Directory -Path $logDir -Force | Out-Null

    for ($attempt = 1; $attempt -le 6; $attempt += 1) {
        if (Test-Path $ngrokStdout) { Remove-Item $ngrokStdout -Force }
        if (Test-Path $ngrokStderr) { Remove-Item $ngrokStderr -Force }

        Start-Process `
            -FilePath 'ngrok' `
            -ArgumentList @('http', '127.0.0.1:8080', '--url', $normalizedUrl, '--log', 'stdout', '--log-format', 'logfmt') `
            -WorkingDirectory $repoRoot `
            -RedirectStandardOutput $ngrokStdout `
            -RedirectStandardError $ngrokStderr | Out-Null

        $ready = Wait-ForCondition -TimeoutSeconds 20 -Condition {
            $tunnel = Get-NgrokTunnelInfo
            return [bool]($tunnel -and $tunnel.public_url -eq $normalizedUrl)
        }

        if ($ready) {
            return Get-NgrokTunnelInfo
        }

        $stderrTail = if (Test-Path $ngrokStderr) { (Get-Content $ngrokStderr -Tail 20) -join [Environment]::NewLine } else { '' }
        if ($stderrTail -match 'ERR_NGROK_334' -and $attempt -lt 6) {
            Stop-NgrokProcesses
            Start-Sleep -Seconds 10
            continue
        }

        throw "ngrok did not start correctly for $normalizedUrl`n$stderrTail"
    }

    throw "ngrok did not start correctly for $normalizedUrl"
}

if (-not (Test-Path $stackScript)) {
    throw "Required script was not found: $stackScript"
}

if ($Restart) {
    Stop-NgrokProcesses
    Start-Sleep -Seconds 1
}

$publicBaseUrl = Get-DotEnvValue -Path $repoEnvPath -Key 'EVOLUTION_API_BASE_URL'
$ngrokPublicUrl = $null

if ($publicBaseUrl -match '^https://[^/]+\.ngrok(?:-free)?\.(?:app|dev)/?$') {
    $ngrokPublicUrl = $publicBaseUrl
    if (-not $ngrokPublicUrl.EndsWith('/')) {
        $ngrokPublicUrl = "$ngrokPublicUrl/"
    }
}

$stackParams = @{}
if ($Restart) {
    $stackParams.Restart = $true
}
if ($ngrokPublicUrl) {
    $stackParams.NgrokUrl = $ngrokPublicUrl
}

Write-Host 'Starting WhatsApp service stack...' -ForegroundColor Cyan
& $stackScript @stackParams

$ngrokTunnel = $null
if ($ngrokPublicUrl) {
    Write-Host ''
    Write-Host "Starting ngrok tunnel on $ngrokPublicUrl" -ForegroundColor Cyan
    $ngrokTunnel = Start-NgrokTunnel -PublicUrl $ngrokPublicUrl
}

$bridgeHealth = $null
try {
    $bridgeHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/__bridge/health' -TimeoutSec 10
} catch {
    $bridgeHealth = $null
}

$publicHealth = $null
if ($ngrokPublicUrl) {
    try {
        $publicHealth = Invoke-RestMethod `
            -Uri ($ngrokPublicUrl.TrimEnd('/') + '/__bridge/health') `
            -Headers @{ 'ngrok-skip-browser-warning' = '1' } `
            -TimeoutSec 15
    } catch {
        $publicHealth = $null
    }
}

Write-Host ''
[pscustomobject]@{
    EvolutionApi = 'http://127.0.0.1:8081'
    EvolutionManager = 'http://127.0.0.1:8081/manager'
    BridgeHealth = 'http://127.0.0.1:8080/__bridge/health'
    BridgeHealthy = [bool]$bridgeHealth
    NgrokUrl = if ($ngrokTunnel) { $ngrokTunnel.public_url } else { $ngrokPublicUrl }
    PublicHealthReady = [bool]$publicHealth
    NgrokApi = if ($ngrokPublicUrl) { 'http://127.0.0.1:4040/api/tunnels' } else { '' }
    NgrokStdoutLog = if ($ngrokPublicUrl) { $ngrokStdout } else { '' }
    NgrokStderrLog = if ($ngrokPublicUrl) { $ngrokStderr } else { '' }
} | Format-List

Write-Host ''
Write-Host 'WhatsApp service is ready.' -ForegroundColor Green
Write-Host 'Use Evolution Manager if the instance ever needs a QR reconnect.' -ForegroundColor DarkGray
