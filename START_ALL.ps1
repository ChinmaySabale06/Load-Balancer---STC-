param(
    [switch]$Reinstall
)

$ErrorActionPreference = 'Stop'

function Ensure-Dependencies($path) {
    if ($Reinstall -or -not (Test-Path (Join-Path $path 'node_modules'))) {
        Write-Host "Installing dependencies in $path..." -ForegroundColor Cyan
        Push-Location $path
        npm install | Write-Host
        Pop-Location
    } else {
        Write-Host "Dependencies already installed in $path" -ForegroundColor DarkGray
    }
}

function Start-ServiceProc($path, $cmd, $title) {
    Write-Host ("Starting {0}..." -f $title) -ForegroundColor Green
    $ps = "cd '$path'; $cmd; Read-Host 'Press Enter to close'"
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `$`"$ps`$`"" -WindowStyle Normal
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$paths = @{
    serverInstances = Join-Path $root 'server-instances'
    loadBalancer    = Join-Path $root 'load-balancer'
    dashboard       = Join-Path $root 'dashboard'
}

Write-Host "Preparing Platefull Load-Balanced environment..." -ForegroundColor Yellow

Ensure-Dependencies $paths.serverInstances
Ensure-Dependencies $paths.loadBalancer
Ensure-Dependencies $paths.dashboard

# Start three backend instances on 5001, 5002, 5003
Start-ServiceProc $paths.serverInstances 'npm run instance1' 'Backend Instance 5001'
Start-ServiceProc $paths.serverInstances 'npm run instance2' 'Backend Instance 5002'
Start-ServiceProc $paths.serverInstances 'npm run instance3' 'Backend Instance 5003'

# Start load balancer (8080)
Start-ServiceProc $paths.loadBalancer 'npm start' 'Load Balancer (8080)'

# Start dashboard (3000)
Start-ServiceProc $paths.dashboard 'npm start' 'Dashboard (3000)'

Start-Sleep -Seconds 2

Write-Host "Opening Dashboard: http://localhost:3000" -ForegroundColor Yellow
Start-Process "http://localhost:3000"

Write-Host "All services launched. Use Ctrl+C in each window to stop, or close the windows." -ForegroundColor Green