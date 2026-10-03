$ErrorActionPreference = "Stop"

$frontendDir = Join-Path $PSScriptRoot "frontend"

# Install dependencies if needed
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Host "Installing frontend dependencies..."
    Push-Location $frontendDir
    npm install
    Pop-Location
}

# Build frontend into frontend/dist/
Write-Host "Building frontend..."
Push-Location $frontendDir
npm run build
Pop-Location

# Start Go server (embeds frontend/dist)
Write-Host "Starting server..."
go run .
