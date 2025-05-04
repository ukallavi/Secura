# PowerShell script to start the frontend locally for Secura
# Usage: ./scripts/start-local-frontend.ps1 [environment]
# Example: ./scripts/start-local-frontend.ps1 development

param (
    [string]$Environment = "development"
)

$ErrorActionPreference = "Stop"

# Determine the environment file to use
$EnvFile = ".env.$Environment"
if (-not (Test-Path $EnvFile)) {
    Write-Host "Environment file $EnvFile not found. Creating from template..."
    if (Test-Path "$EnvFile.template") {
        Copy-Item "$EnvFile.template" $EnvFile
        Write-Host "Created $EnvFile from template. Please review and update if needed."
    } else {
        Write-Error "Template file $EnvFile.template not found. Cannot continue."
        exit 1
    }
}

# Get the root directory of the project
$RootDir = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $RootDir "frontend"

# Copy environment file to frontend directory
if (-not (Test-Path (Join-Path $FrontendDir ".env.local"))) {
    Write-Host "Copying environment file to frontend directory..."
    Copy-Item $EnvFile (Join-Path $FrontendDir ".env.local")
}

# Install dependencies if node_modules doesn't exist
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "Installing frontend dependencies..."
    Push-Location $FrontendDir
    npm install
    Pop-Location
}

# Install dependencies from package.json
Write-Host "Installing frontend dependencies..."
Push-Location $FrontendDir
npm install
Pop-Location

# Start the frontend
Write-Host "Starting frontend in $Environment mode..."
Push-Location $FrontendDir
if ($Environment -eq "development") {
    npm run dev
} elseif ($Environment -eq "testing") {
    # For testing, we might want to run in development mode but with test API
    npm run dev
} elseif ($Environment -eq "production") {
    # Build and start in production mode
    npm run build
    npm run start
} else {
    # For staging or any other environment, build and start
    npm run build
    npm run start
}
Pop-Location
