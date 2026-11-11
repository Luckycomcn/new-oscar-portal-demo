$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$fixture = Join-Path $root ('tmp/docker delivery test/' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Join-Path $fixture 'scripts') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'scripts/build-delivery.ps1') -Destination (Join-Path $fixture 'scripts')
Copy-Item -LiteralPath (Join-Path $root 'scripts/docker-env.ps1') -Destination (Join-Path $fixture 'scripts')
Set-Content -LiteralPath (Join-Path $fixture 'LICENSE') -Value 'fixture'
Set-Content -LiteralPath (Join-Path $fixture 'NOTICE') -Value 'fixture'
$envPath = Join-Path $fixture '.env.local'
@'
# Non-secret test fixtures, not actual service keys.
export VITE_AMAP_KEY = "fixture-amap" # inline comment
VITE_TIANDITU_KEY='fixture-tdt'
VITE_AMAP_SECURITY_JS_CODE=fixture#security
IGNORED_VARIABLE=ignored
'@ | Set-Content -LiteralPath $envPath
$global:OscarDockerTestState = @{ commands = [System.Collections.Generic.List[object]]::new(); failBuild = $false }
function Assert-True($condition, $message) { if (-not $condition) { throw $message } }
function docker {
    $arguments = @($args)
    $global:OscarDockerTestState.commands.Add($arguments)
    $global:LASTEXITCODE = 0
    switch ($arguments[0]) {
        'info' { return 'linux' }
        'build' {
            Assert-True ($env:VITE_AMAP_KEY -eq 'fixture-amap') 'AMap build environment was not populated.'
            Assert-True ($env:VITE_TIANDITU_KEY -eq 'fixture-tdt') 'Tianditu build environment was not populated.'
            Assert-True (-not (($arguments -join ' ') -match 'fixture')) 'Key values leaked into Docker arguments.'
            Assert-True (-not (($arguments -join ' ') -match 'SECURITY_JS_CODE')) 'Security code must not be passed to build.'
            if ($global:OscarDockerTestState.failBuild) { $global:LASTEXITCODE = 1 }
        }
        'run' {
            $index = [Array]::IndexOf($arguments, '--env-file')
            Assert-True ($index -ge 0) 'Runtime environment file was not passed.'
            $runtime = [System.IO.File]::ReadAllText($arguments[$index + 1])
            Assert-True ($runtime -eq "AMAP_SECURITY_JS_CODE=fixture#security`n") 'Runtime file contains unexpected variables.'
        }
        'save' {
            $index = [Array]::IndexOf($arguments, '--output')
            [System.IO.File]::WriteAllText($arguments[$index + 1], 'mock image archive')
        }
        default { throw 'Unexpected Docker operation.' }
    }
}
$oldAmap = [Environment]::GetEnvironmentVariable('VITE_AMAP_KEY', 'Process')
$oldTianditu = [Environment]::GetEnvironmentVariable('VITE_TIANDITU_KEY', 'Process')
try {
    $env:VITE_AMAP_KEY = 'previous-amap'
    $env:VITE_TIANDITU_KEY = 'previous-tdt'
    $entry = Join-Path $fixture 'scripts/build-delivery.ps1'
    $output = (& $entry -ImageTag 'test-portal:1' -Start -Port 8099 *>&1 | Out-String)
    Assert-True ($global:OscarDockerTestState.commands.Count -eq 5) 'Expected engine check, build, Nginx check, export and startup.'
    Assert-True ($env:VITE_AMAP_KEY -eq 'previous-amap' -and $env:VITE_TIANDITU_KEY -eq 'previous-tdt') 'Process environment was not restored.'
    Assert-True (-not ($output -match 'fixture-amap|fixture-tdt|fixture#security')) 'Script output leaked keys.'
    $instructions = Get-Content -LiteralPath (Join-Path $fixture 'delivery/DEPLOYMENT.md') -Raw
    Assert-True ($instructions.Contains('--env-file runtime.env')) 'Deployment instructions omit runtime configuration.'
    Assert-True (-not $instructions.Contains('fixture#security')) 'Security code leaked into deployment instructions.'
    Assert-True (($global:OscarDockerTestState.commands[4] -join ' ').Contains('8099:8080')) 'Configured port not used.'
    $count = $global:OscarDockerTestState.commands.Count
    & $entry -Check | Out-Null
    Assert-True ($global:OscarDockerTestState.commands.Count -eq $count) 'Check mode must not invoke Docker.'
    $global:OscarDockerTestState.failBuild = $true
    $failed = $false
    try { & $entry *>&1 | Out-Null } catch { $failed = $_.Exception.Message -eq 'Image build failed.' }
    Assert-True $failed 'Build failure was not propagated.'
    Assert-True ($env:VITE_AMAP_KEY -eq 'previous-amap' -and $env:VITE_TIANDITU_KEY -eq 'previous-tdt') 'Environment was not restored after a failed build.'
    $badPath = Join-Path $fixture 'missing.env'
    Set-Content -LiteralPath $badPath -Value 'VITE_AMAP_KEY=fixture-amap'
    $failed = $false
    try { & $entry -EnvFile $badPath -Check *>&1 | Out-Null } catch { $failed = $_.Exception.Message.Contains('security code is missing') }
    Assert-True $failed 'Missing AMap security code must fail before Docker.'
    Write-Host 'PASS: dotenv parsing, build arguments, runtime-only security code, export/start, no secret output, environment restoration and missing-code validation (Docker mocked).'
} finally {
    [Environment]::SetEnvironmentVariable('VITE_AMAP_KEY', $oldAmap, 'Process')
    [Environment]::SetEnvironmentVariable('VITE_TIANDITU_KEY', $oldTianditu, 'Process')
}
