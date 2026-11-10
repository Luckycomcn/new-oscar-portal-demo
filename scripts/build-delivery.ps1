param(
    [string]$ImageTag = 'new-oscar-portal-demo:1.0.0',
    [string]$AmapKey = '',
    [string]$TiandituKey = ''
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$deliveryRoot = Join-Path $projectRoot 'delivery'
$archiveName = 'new-oscar-portal-demo-1.0.0-linux-amd64.tar'
$archivePath = Join-Path $deliveryRoot $archiveName

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Install Docker and start its Linux container engine first.'
}
$dockerOs = docker info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0 -or $dockerOs -ne 'linux') {
    throw 'Docker Linux engine is unavailable. Start Docker Desktop in Linux containers mode and retry.'
}
New-Item -ItemType Directory -Path $deliveryRoot -Force | Out-Null

docker build --platform linux/amd64 --tag $ImageTag --build-arg "VITE_AMAP_KEY=$AmapKey" --build-arg "VITE_TIANDITU_KEY=$TiandituKey" --build-arg 'VITE_AMAP_SERVICE_HOST=/_AMapService' $projectRoot
if ($LASTEXITCODE -ne 0) { throw 'Image build failed.' }
docker run --rm --platform linux/amd64 $ImageTag nginx -t
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

    docker run -d --name oscar-portal --restart unless-stopped -p 8080:8080 $ImageTag

4. Open http://localhost:8080 (or http://SERVER_IP:8080).

The target server does not need Node.js or the source code.
Catalogue queries, metadata downloads and maps require internet access.
OpenStreetMap needs no key. Optional AMap/Tianditu keys must be supplied at build time.
For AMap, also pass -e AMAP_SECURITY_JS_CODE=YOUR_CODE to docker run.
The default image contains no private map keys.

Check logs: docker logs oscar-portal
Stop: docker stop oscar-portal
Remove container: docker rm oscar-portal (stop it first)

Verify the archive on Linux: sha256sum -c SHA256SUMS.txt
Verify on PowerShell: Get-FileHash ./$archiveName -Algorithm SHA256

See LICENSE and NOTICE for licensing and attribution.
"@
Set-Content -LiteralPath (Join-Path $deliveryRoot 'DEPLOYMENT.md') -Value $instructions -Encoding utf8
Write-Host "Delivery files are ready: $deliveryRoot"
