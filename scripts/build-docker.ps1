# PowerShell script to build Docker container for Secura
# Usage: ./scripts/build-docker.ps1 [environment]
# Example: ./scripts/build-docker.ps1 development

param (
    [string]$Environment = "development"
)

$ErrorActionPreference = "Stop"

# Determine the environment file and Dockerfile to use
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

# Determine which Dockerfile to use based on environment
$DockerfilePath = "Dockerfile.$Environment"
if (-not (Test-Path $DockerfilePath)) {
    Write-Warning "Dockerfile for $Environment not found. Using Dockerfile.dev as fallback."
    $DockerfilePath = "Dockerfile.dev"
    
    if (-not (Test-Path $DockerfilePath)) {
        Write-Error "Fallback Dockerfile.dev not found. Cannot continue."
        exit 1
    }
}

# Set image tag based on environment
$ImageTag = "secura:$Environment"
if ($Environment -eq "production") {
    $ImageTag = "secura:latest"
}

# Build the Docker image
Write-Host "Building Docker image for $Environment environment..."
Write-Host "Using Dockerfile: $DockerfilePath"
Write-Host "Image tag: $ImageTag"

docker build -t $ImageTag -f $DockerfilePath --build-arg ENV=$Environment .

if ($LASTEXITCODE -eq 0) {
    Write-Host "Docker image built successfully: $ImageTag" -ForegroundColor Green
} else {
    Write-Error "Failed to build Docker image. Exit code: $LASTEXITCODE"
    exit $LASTEXITCODE
}
