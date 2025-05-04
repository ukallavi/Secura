# PowerShell script to deploy Secura Docker container
# Usage: ./scripts/deploy-docker.ps1 [environment]
# Example: ./scripts/deploy-docker.ps1 development

param (
    [string]$Environment = "development"
)

$ErrorActionPreference = "Stop"

# Determine the docker-compose file to use
$ComposeFile = "docker-compose.$Environment.yml"
if (-not (Test-Path $ComposeFile)) {
    Write-Error "Docker Compose file $ComposeFile not found. Cannot continue."
    exit 1
}

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

# Build the Docker image if needed
Write-Host "Building Docker image for $Environment environment..."
& "$PSScriptRoot\build-docker.ps1" -Environment $Environment

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build Docker image. Cannot continue."
    exit $LASTEXITCODE
}

# Deploy using docker-compose
Write-Host "Deploying Secura for $Environment environment using $ComposeFile..."

# Stop any existing containers
Write-Host "Stopping existing containers..."
docker-compose -f $ComposeFile down

# Start the containers with the environment file
Write-Host "Starting containers..."
docker-compose -f $ComposeFile --env-file $EnvFile up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "Secura deployed successfully for $Environment environment!" -ForegroundColor Green
    
    # Display container status
    docker-compose -f $ComposeFile ps
    
    # Display access URLs based on environment
    if ($Environment -eq "development") {
        Write-Host "Access the application at: http://localhost:3000" -ForegroundColor Cyan
    } elseif ($Environment -eq "testing") {
        Write-Host "Access the application at: http://localhost:3001" -ForegroundColor Cyan
    } else {
        # For staging and production, use the domain from the environment file
        $envContent = Get-Content $EnvFile
        $domainLine = $envContent | Where-Object { $_ -match "DOMAIN_NAME=" }
        if ($domainLine -match "DOMAIN_NAME=(.*)") {
            $domain = $matches[1]
            Write-Host "Access the application at: https://$domain" -ForegroundColor Cyan
        } else {
            Write-Host "Application deployed. Check your configured domain." -ForegroundColor Cyan
        }
    }
} else {
    Write-Error "Failed to deploy Secura. Exit code: $LASTEXITCODE"
    exit $LASTEXITCODE
}
