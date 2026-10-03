$ErrorActionPreference = "Stop"

# Go Backend
Write-Host "Starting Go backend on port 8001..."
$backend = Start-Process -FilePath "go" -ArgumentList "run", "." -WorkingDirectory $PSScriptRoot -NoNewWindow -PassThru -Environment @{ PORT = "8001" }

# Frontend dependencies
$frontendDir = Join-Path $PSScriptRoot "frontend"
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Host "Installing frontend dependencies..."
    Push-Location $frontendDir
    npm install
    Pop-Location
}

# Vite Dev Server
Write-Host "Starting Vite dev server..."
$frontend = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $frontendDir -NoNewWindow -PassThru

Write-Host ""
Write-Host "App running at http://localhost:5173"
Write-Host "Press Ctrl+C to stop both processes."

try {
    Wait-Process -Id $backend.Id
} finally {
    if (-not $frontend.HasExited)  { Stop-Process -Id $frontend.Id  -Force }
    if (-not $backend.HasExited)   { Stop-Process -Id $backend.Id   -Force }
}
