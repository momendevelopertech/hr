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

function Stop-NodeProcessesByCommandMatch {
    param([string]$Pattern)

    Get-CimInstance Win32_Process |
        Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match $Pattern } |
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

function Start-EvolutionApi {
    if (-not (Test-Path $evolutionDir)) {
        throw "Evolution API folder was not found at $evolutionDir"
    }

    if (-not (Test-Path $evolutionEnvPath)) {
        throw "Evolution API .env was not found at $evolutionEnvPath"
    }

    if (Test-ListeningPort -Port $evolutionPort) {
        return
    }

    $env:SERVER_PORT = "$evolutionPort"
    $env:SERVER_URL = "http://127.0.0.1:$evolutionPort"
    $env:CACHE_REDIS_ENABLED = 'false'
    $env:CACHE_LOCAL_ENABLED = 'true'

    if (Test-Path $evolutionStdout) { Remove-Item $evolutionStdout -Force }
    if (Test-Path $evolutionStderr) { Remove-Item $evolutionStderr -Force }

    $distEntry = Join-Path $evolutionDir 'dist\main.js'
    $timeoutSeconds = 90
    $startupCommand = ''
    $process = $null

    if (Test-Path $distEntry) {
        $startupCommand = 'node dist\main.js'
        $process = Start-Process `
            -FilePath 'node.exe' `
            -ArgumentList 'dist\main.js' `
            -WorkingDirectory $evolutionDir `
            -RedirectStandardOutput $evolutionStdout `
            -RedirectStandardError $evolutionStderr `
            -PassThru
    } else {
        $startupCommand = 'node_modules\.bin\tsx.cmd .\src\main.ts'
        $timeoutSeconds = 150
        $process = Start-Process `
            -FilePath 'cmd.exe' `
            -ArgumentList '/c', 'node_modules\\.bin\\tsx.cmd', '.\\src\\main.ts' `
            -WorkingDirectory $evolutionDir `
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
}

function Start-Bridge {
    param([string]$ApiKey)

    if (-not (Test-Path $bridgeScript)) {
        throw "Bridge script was not found at $bridgeScript"
    }

    if (Test-ListeningPort -Port $bridgePort) {
        return
    }

    New-Item -ItemType Directory -Path $logDir -Force | Out-Null

    if (Test-Path $bridgeStdout) { Remove-Item $bridgeStdout -Force }
    if (Test-Path $bridgeStderr) { Remove-Item $bridgeStderr -Force }

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
        throw "Bridge did not start on port $bridgePort"
    }
}

if ($Restart) {
    Stop-ProcessesListeningOnPort -Port $bridgePort
    Stop-ProcessesListeningOnPort -Port $evolutionPort
    Stop-NodeProcessesByCommandMatch -Pattern ([regex]::Escape($evolutionDir))
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
