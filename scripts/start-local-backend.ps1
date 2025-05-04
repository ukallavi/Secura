# PowerShell script to start the backend locally for Secura
# Usage: ./scripts/start-local-backend.ps1 [environment]
# Example: ./scripts/start-local-backend.ps1 development

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

# Copy environment file to backend directory
if (-not (Test-Path "backend\.env")) {
    Write-Host "Copying environment file to backend directory..."
    Copy-Item $EnvFile "backend\.env"
}

# Install dependencies if node_modules doesn't exist
if (-not (Test-Path "backend\node_modules")) {
    Write-Host "Installing backend dependencies..."
    Push-Location backend
    npm install
    Pop-Location
}

# Install dependencies from package.json files

# Install database dependencies first
Write-Host "Installing database dependencies..."
Push-Location database
npm install
Pop-Location

# Install backend dependencies
Write-Host "Installing backend dependencies..."
Push-Location backend
npm install

# Start the backend
Write-Host "Starting backend in $Environment mode..."
if ($Environment -eq "development") {
    npm run dev
} elseif ($Environment -eq "testing") {
    npm run test
} elseif ($Environment -eq "production") {
    npm run start
} else {
    # For staging or any other environment, use production mode
    npm run start
}
Pop-Location
