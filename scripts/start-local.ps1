# PowerShell script to start all Secura components locally
# Usage: ./scripts/start-local.ps1 [environment]
# Example: ./scripts/start-local.ps1 development

param (
    [string]$Environment = "development"
)

$ErrorActionPreference = "Stop"

# Setup the database first
Write-Host "Setting up the database..."
& "$PSScriptRoot\setup-local-db.ps1" -Environment $Environment

# Start the backend in a new window
Write-Host "Starting the backend in a new window..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$PSScriptRoot\start-local-backend.ps1' -Environment $Environment"

# Give the backend a moment to start
Start-Sleep -Seconds 5

# Start the frontend in the current window
Write-Host "Starting the frontend..."
& "$PSScriptRoot\start-local-frontend.ps1" -Environment $Environment
