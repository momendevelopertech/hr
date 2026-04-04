param(
    [string]$NgrokUrl = '',
    [switch]$Restart
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$repoEnvPath = Join-Path $repoRoot '.env'
$logDir = Join-Path (Join-Path $repoRoot '.codex-logs') 'whatsapp-stack'
$bridgeScript = Join-Path $PSScriptRoot 'evolution-bridge.js'
$bridgeStdout = Join-Path $logDir 'bridge-stdout.log'
$bridgeStderr = Join-Path $logDir 'bridge-stderr.log'

$evolutionDir = 'F:\tools\evolution-api'
$evolutionEnvPath = Join-Path $evolutionDir '.env'
$evolutionStdout = Join-Path $evolutionDir 'evolution-8081-stdout.log'
$evolutionStderr = Join-Path $evolutionDir 'evolution-8081-stderr.log'

$bridgePort = 8080
$evolutionPort = 8081
$instanceName = 'sphinxhr'

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

function Set-DotEnvValue {
    param(
        [string]$Path,
        [string]$Key,
        [string]$Value
    )

    $escapedKey = [regex]::Escape($Key)
    $lines = @()

    if (Test-Path $Path) {
        $lines = Get-Content -Path $Path
    }

    $found = $false
    $nextLines = foreach ($line in $lines) {
        if ($line -match "^\s*$escapedKey\s*=") {
            $found = $true
            "$Key=$Value"
        } else {
            $line
        }
    }

    if (-not $found) {
        $nextLines += "$Key=$Value"
    }

    Set-Content -Path $Path -Value $nextLines
}

function Test-ListeningPort {
    param([int]$Port)

    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Wait-ForPort {
    param(
        [int]$Port,
        [int]$ProcessId = 0,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-ListeningPort -Port $Port) {
            return $true
        }

        if ($ProcessId -gt 0 -and -not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
            return $false
        }

        Start-Sleep -Seconds 2
    }

    return $false
}

function Wait-ForCondition {
    param(
        [scriptblock]$Condition,
        [int]$TimeoutSeconds = 30,
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

function Get-LogTailText {
    param(
        [string]$Path,
        [int]$Lines = 40
    )

    if (-not (Test-Path $Path)) {
        return '[log file not found]'
    }

    $content = (Get-Content -Path $Path -Tail $Lines -ErrorAction SilentlyContinue) -join [Environment]::NewLine
    if ([string]::IsNullOrWhiteSpace($content)) {
        return '[log file is empty]'
    }

    return $content.Trim()
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

function Stop-NodeProcessesByCommandMatch {
    param([string]$Pattern)

    Get-CimInstance Win32_Process |
        Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match $Pattern } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Stop-LegacyEvolutionProcesses {
    Get-CimInstance Win32_Process |
        Where-Object {
            $_.Name -eq 'node.exe' -and
            $_.CommandLine -match '(^|["\s])dist\\main(\.js)?($|["\s])'
        } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
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

function Test-EvolutionManagerReady {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$evolutionPort/manager" -UseBasicParsing -TimeoutSec 10
        return [bool]($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
    } catch {
        return $false
    }
}

function Get-BridgeHealth {
    try {
        return Invoke-RestMethod -Uri "http://127.0.0.1:$bridgePort/__bridge/health" -TimeoutSec 10
    } catch {
        return $null
    }
}

function Test-BridgeReady {
    $health = Get-BridgeHealth
    if (-not $health) {
        return $false
    }

    return [bool](
        $health.ok -eq $true -and
        $health.instanceName -eq $instanceName -and
        $health.target -eq "http://127.0.0.1:$evolutionPort"
    )
}

function Start-EvolutionApi {
    if (-not (Test-Path $evolutionDir)) {
        throw "Evolution API folder was not found at $evolutionDir"
    }

    if (-not (Test-Path $evolutionEnvPath)) {
        throw "Evolution API .env was not found at $evolutionEnvPath"
    }

    if (Test-ListeningPort -Port $evolutionPort) {
        if (Test-EvolutionManagerReady) {
            return
        }

        Stop-ProcessesListeningOnPort -Port $evolutionPort
        Stop-NodeProcessesByCommandMatch -Pattern ([regex]::Escape($evolutionDir))
        Start-Sleep -Seconds 2
    }

    $env:SERVER_PORT = "$evolutionPort"
    $env:SERVER_URL = "http://127.0.0.1:$evolutionPort"
    $env:CACHE_REDIS_ENABLED = 'false'
    $env:CACHE_LOCAL_ENABLED = 'true'

    $script:evolutionStdout = Resolve-LogPath -Path $evolutionStdout
    $script:evolutionStderr = Resolve-LogPath -Path $evolutionStderr

    $distEntry = Join-Path $evolutionDir 'dist\main.js'
    $timeoutSeconds = 180
    $startupCommand = ''
    $process = $null

    if (Test-Path $distEntry) {
        $startupCommand = "cmd /c cd /d `"$evolutionDir`" && node dist\main.js"
        $process = Start-Process `
            -FilePath 'cmd.exe' `
            -ArgumentList '/c', "cd /d `"$evolutionDir`" && node dist\main.js" `
            -RedirectStandardOutput $evolutionStdout `
            -RedirectStandardError $evolutionStderr `
            -PassThru
    } else {
        $startupCommand = "cmd /c cd /d `"$evolutionDir`" && node_modules\.bin\tsx.cmd .\src\main.ts"
        $timeoutSeconds = 210
        $process = Start-Process `
            -FilePath 'cmd.exe' `
            -ArgumentList '/c', "cd /d `"$evolutionDir`" && node_modules\\.bin\\tsx.cmd .\\src\\main.ts" `
            -RedirectStandardOutput $evolutionStdout `
            -RedirectStandardError $evolutionStderr `
            -PassThru
    }

    if (-not (Wait-ForPort -Port $evolutionPort -ProcessId $process.Id -TimeoutSeconds $timeoutSeconds)) {
        $stdoutTail = Get-LogTailText -Path $evolutionStdout
        $stderrTail = Get-LogTailText -Path $evolutionStderr
        $processState = if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) { 'running' } else { 'exited' }

        throw @"
Evolution API did not become ready on port $evolutionPort within $timeoutSeconds seconds.
Startup command: $startupCommand
Process state: $processState
Stdout tail:
$stdoutTail

Stderr tail:
$stderrTail
"@
    }

    if (-not (Wait-ForCondition -TimeoutSeconds 60 -Condition { Test-EvolutionManagerReady })) {
        $stdoutTail = Get-LogTailText -Path $evolutionStdout
        $stderrTail = Get-LogTailText -Path $evolutionStderr
        throw @"
Evolution API opened port $evolutionPort but the manager endpoint never became ready.
Stdout tail:
$stdoutTail

Stderr tail:
$stderrTail
"@
    }
}

function Start-Bridge {
    param([string]$ApiKey)

    if (-not (Test-Path $bridgeScript)) {
        throw "Bridge script was not found at $bridgeScript"
    }

    if (Test-ListeningPort -Port $bridgePort) {
        if (Test-BridgeReady) {
            return
        }

        Stop-ProcessesListeningOnPort -Port $bridgePort
        Stop-NodeProcessesByCommandMatch -Pattern ([regex]::Escape($bridgeScript))
        Start-Sleep -Seconds 2
    }

    New-Item -ItemType Directory -Path $logDir -Force | Out-Null

    $script:bridgeStdout = Resolve-LogPath -Path $bridgeStdout
    $script:bridgeStderr = Resolve-LogPath -Path $bridgeStderr

    $env:PORT = "$bridgePort"
    $env:EVOLUTION_TARGET_URL = "http://127.0.0.1:$evolutionPort"
    $env:EVOLUTION_INSTANCE_NAME = $instanceName
    $env:EVOLUTION_API_KEY = $ApiKey

    Start-Process `
        -FilePath 'node.exe' `
        -ArgumentList $bridgeScript `
        -WorkingDirectory $repoRoot `
        -RedirectStandardOutput $bridgeStdout `
        -RedirectStandardError $bridgeStderr | Out-Null

    if (-not (Wait-ForPort -Port $bridgePort -TimeoutSeconds 15)) {
        $stdoutTail = Get-LogTailText -Path $bridgeStdout
        $stderrTail = Get-LogTailText -Path $bridgeStderr
        throw @"
Bridge did not start on port $bridgePort.
Stdout tail:
$stdoutTail

Stderr tail:
$stderrTail
"@
    }

    if (-not (Wait-ForCondition -TimeoutSeconds 20 -Condition { Test-BridgeReady })) {
        $stdoutTail = Get-LogTailText -Path $bridgeStdout
        $stderrTail = Get-LogTailText -Path $bridgeStderr
        throw @"
Bridge port $bridgePort opened but the health endpoint is not reporting the expected service.
Stdout tail:
$stdoutTail

Stderr tail:
$stderrTail
"@
    }
}

if ($Restart) {
    Stop-ProcessesListeningOnPort -Port $bridgePort
    Stop-ProcessesListeningOnPort -Port $evolutionPort
    Stop-NodeProcessesByCommandMatch -Pattern ([regex]::Escape($evolutionDir))
    Stop-LegacyEvolutionProcesses
    Stop-NodeProcessesByCommandMatch -Pattern ([regex]::Escape($bridgeScript))
    Start-Sleep -Seconds 2
}

$apiKey = Get-DotEnvValue -Path $evolutionEnvPath -Key 'AUTHENTICATION_API_KEY'
if (-not $apiKey) {
    throw "AUTHENTICATION_API_KEY was not found in $evolutionEnvPath"
}

if ($NgrokUrl) {
    if (-not $NgrokUrl.EndsWith('/')) {
        $NgrokUrl = "$NgrokUrl/"
    }

    if (-not (Test-Path $repoEnvPath)) {
        throw "Repo .env was not found at $repoEnvPath"
    }

    Set-DotEnvValue -Path $repoEnvPath -Key 'EVOLUTION_API_BASE_URL' -Value $NgrokUrl
}

Start-EvolutionApi
Start-Bridge -ApiKey $apiKey

$instanceState = 'unknown'
try {
    $stateResponse = Invoke-RestMethod `
        -Uri "http://127.0.0.1:$evolutionPort/instance/connectionState/$instanceName" `
        -Headers @{ apikey = $apiKey } `
        -Method GET `
        -TimeoutSec 10

    if ($stateResponse.instance.state) {
        $instanceState = $stateResponse.instance.state
    }
} catch {
    $instanceState = 'unreachable'
}

$bridgeHealth = $null
try {
    $bridgeHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$bridgePort/__bridge/health" -TimeoutSec 10
} catch {
    $bridgeHealth = $null
}

[pscustomobject]@{
    EvolutionListening = Test-ListeningPort -Port $evolutionPort
    EvolutionUrl = "http://127.0.0.1:$evolutionPort"
    EvolutionManager = "http://127.0.0.1:$evolutionPort/manager"
    BridgeListening = Test-ListeningPort -Port $bridgePort
    BridgeHealth = "http://127.0.0.1:$bridgePort/__bridge/health"
    InstanceName = $instanceName
    InstanceState = $instanceState
    RepoEvolutionApiBaseUrl = Get-DotEnvValue -Path $repoEnvPath -Key 'EVOLUTION_API_BASE_URL'
    EvolutionStdoutLog = $evolutionStdout
    EvolutionStderrLog = $evolutionStderr
    BridgeStdoutLog = $bridgeStdout
    BridgeStderrLog = $bridgeStderr
} | Format-List

Write-Host ''
Write-Host 'Next steps:'
Write-Host '1. Start ngrok if needed: ngrok http 127.0.0.1:8080'
Write-Host '2. If ngrok generated a new public URL, rerun this script with -NgrokUrl <https://your-ngrok-url/>'
Write-Host '3. If the instance state is not open, open the manager and generate a QR code'
Write-Host '4. Then test WhatsApp sending from the HR app'
