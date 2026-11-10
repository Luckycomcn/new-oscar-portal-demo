$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$deliveryRoot = Join-Path $projectRoot 'delivery'
$imageTag = 'oscar-surface:1.0.0'
$archivePath = Join-Path $deliveryRoot 'oscar-surface-1.0.0-linux-amd64.tar'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is not installed or not on PATH. Install and start Docker with Linux containers, then retry.'
}
docker info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0) { throw 'Docker Engine is unavailable. Start Docker and retry.' }

Push-Location $projectRoot
try {
    $mapSettings = node --input-type=module -e "import {loadEnv} from 'vite'; const e=loadEnv('production',process.cwd()); console.log(JSON.stringify({amap:e.VITE_AMAP_KEY,tianditu:e.VITE_TIANDITU_KEY}));" | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Unable to read map build settings with Vite.' }
} finally {
    Pop-Location
}

docker build --platform linux/amd64 --tag $imageTag --build-arg "VITE_AMAP_KEY=$($mapSettings.amap)" --build-arg "VITE_TIANDITU_KEY=$($mapSettings.tianditu)" --build-arg 'VITE_AMAP_SERVICE_HOST=/_AMapService' $projectRoot
if ($LASTEXITCODE -ne 0) { throw 'Image build failed; no delivery archive was generated.' }

# Validate the bundled web server configuration before exporting.
docker run --rm --platform linux/amd64 --env AMAP_SECURITY_JS_CODE=configuration-check $imageTag nginx -t
if ($LASTEXITCODE -ne 0) { throw 'Nginx configuration validation failed.' }

docker compose --env-file (Join-Path $projectRoot '.env.local') --file (Join-Path $deliveryRoot 'compose.yaml') config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Compose configuration validation failed.' }

docker save --output $archivePath $imageTag
if ($LASTEXITCODE -ne 0) { throw 'Image export failed.' }

Copy-Item -LiteralPath (Join-Path $projectRoot 'LICENSE') -Destination $deliveryRoot
Copy-Item -LiteralPath (Join-Path $projectRoot 'NOTICE') -Destination $deliveryRoot
$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $deliveryRoot 'SHA256SUMS.txt') -Value "$archiveHash  $(Split-Path -Leaf $archivePath)" -Encoding ascii
Write-Host "Delivery files are ready: $deliveryRoot"
