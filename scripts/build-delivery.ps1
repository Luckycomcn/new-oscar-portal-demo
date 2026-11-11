param(
    [string]$ImageTag = 'new-oscar-portal-demo:1.0.0',
    [string]$AmapKey = '',
    [string]$TiandituKey = '',
    [string]$EnvFile = '.env.local',
    [switch]$Start,
    [ValidateRange(1, 65535)][int]$Port = 8080,
    [string]$ContainerName = 'oscar-portal',
    [switch]$Check
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'docker-env.ps1')
if (-not [System.IO.Path]::IsPathRooted($EnvFile)) { $EnvFile = Join-Path $projectRoot $EnvFile }
$settings = Read-MapEnvironment -Path $EnvFile
if (-not $AmapKey) { $AmapKey = $settings['VITE_AMAP_KEY'] }
if (-not $TiandituKey) { $TiandituKey = $settings['VITE_TIANDITU_KEY'] }
$securityCode = $settings['AMAP_SECURITY_JS_CODE']
if (-not $securityCode) { $securityCode = $settings['VITE_AMAP_SECURITY_JS_CODE'] }
if ($AmapKey -and -not $securityCode) { throw 'AMap key is configured but its security code is missing. Set VITE_AMAP_SECURITY_JS_CODE or AMAP_SECURITY_JS_CODE in the environment file.' }
foreach ($entry in @(@('AMap key', $AmapKey), @('Tianditu key', $TiandituKey), @('AMap security code', $securityCode))) {
    $status = if ($entry[1]) { 'configured' } else { 'not configured (optional)' }
    Write-Host "$($entry[0]): $status"
}
if ($Check) { Write-Host 'Configuration check passed. No image, container or delivery files were created.'; return }
$deliveryRoot = Join-Path $projectRoot 'delivery'
$archiveName = ($ImageTag -replace '[^A-Za-z0-9._-]', '-') + '-linux-amd64.tar'
$archivePath = Join-Path $deliveryRoot $archiveName
$runtimePath = Join-Path $deliveryRoot 'runtime.env'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Install Docker and start its Linux container engine first.'
}
$dockerOs = docker info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0 -or $dockerOs -ne 'linux') {
    throw 'Docker Linux engine is unavailable. Start Docker Desktop in Linux containers mode and retry.'
}
New-Item -ItemType Directory -Path $deliveryRoot -Force | Out-Null

# Bare argument names read values from the process environment. Never pass the
# security code into the build, or print key values in the command arguments.
$previousAmap = [Environment]::GetEnvironmentVariable('VITE_AMAP_KEY', 'Process')
$previousTianditu = [Environment]::GetEnvironmentVariable('VITE_TIANDITU_KEY', 'Process')
try {
    [Environment]::SetEnvironmentVariable('VITE_AMAP_KEY', [string]$AmapKey, 'Process')
    [Environment]::SetEnvironmentVariable('VITE_TIANDITU_KEY', [string]$TiandituKey, 'Process')
    docker build --platform linux/amd64 --tag $ImageTag --build-arg VITE_AMAP_KEY --build-arg VITE_TIANDITU_KEY --build-arg 'VITE_AMAP_SERVICE_HOST=/_AMapService' $projectRoot
    if ($LASTEXITCODE -ne 0) { throw 'Image build failed.' }
} finally {
    [Environment]::SetEnvironmentVariable('VITE_AMAP_KEY', $previousAmap, 'Process')
    [Environment]::SetEnvironmentVariable('VITE_TIANDITU_KEY', $previousTianditu, 'Process')
}
# Companion file is excluded from Git and the Docker build context.
[System.IO.File]::WriteAllText($runtimePath, "AMAP_SECURITY_JS_CODE=$securityCode`n", (New-Object System.Text.UTF8Encoding($false)))
docker run --rm --platform linux/amd64 --env-file $runtimePath $ImageTag nginx -t
if ($LASTEXITCODE -ne 0) { throw 'Nginx configuration validation failed.' }
docker save --output $archivePath $ImageTag
if ($LASTEXITCODE -ne 0) { throw 'Image export failed.' }

Copy-Item -LiteralPath (Join-Path $projectRoot 'LICENSE') -Destination $deliveryRoot
Copy-Item -LiteralPath (Join-Path $projectRoot 'NOTICE') -Destination $deliveryRoot
$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $deliveryRoot 'SHA256SUMS.txt') -Value "$archiveHash  $archiveName" -Encoding ascii
$instructions = @"
# New OSCAR Portal - Demo

Image: $ImageTag
Platform: Linux amd64 (x86_64)

1. Install Docker and start the Linux container engine.
2. Import the image:

    docker load -i $archiveName

3. Start the portal:

    docker run -d --name $ContainerName --restart unless-stopped -p ${Port}:8080 --env-file runtime.env $ImageTag

4. Open http://localhost:$Port (or http://SERVER_IP:$Port).

The target server does not need Node.js or the source code.
Catalogue queries, metadata downloads and maps require internet access.
AMap/Tianditu browser keys were read from the build configuration and bundled
into the frontend. Changing these keys requires rebuilding the image.
runtime.env contains the AMap security code; keep it private. It is not included
in the image archive. Start the container from this delivery directory, so Docker
can read runtime.env. Changing its code requires recreating the container.

Check logs: docker logs oscar-portal
Stop: docker stop oscar-portal
Remove container: docker rm oscar-portal (stop it first)

Verify the archive on Linux: sha256sum -c SHA256SUMS.txt
Verify on PowerShell: Get-FileHash ./$archiveName -Algorithm SHA256

See LICENSE and NOTICE for licensing and attribution.
"@
Set-Content -LiteralPath (Join-Path $deliveryRoot 'DEPLOYMENT.md') -Value $instructions -Encoding utf8
Write-Host "Delivery files are ready: $deliveryRoot"
Write-Host 'runtime.env contains the runtime security code; it is not embedded in the image.'
if ($Start) {
    docker run -d --name $ContainerName --restart unless-stopped -p "${Port}:8080" --env-file $runtimePath $ImageTag
    if ($LASTEXITCODE -ne 0) { throw 'Container startup failed. Check whether the container name or port is already in use.' }
    Write-Host "Portal started: http://localhost:$Port"
}
