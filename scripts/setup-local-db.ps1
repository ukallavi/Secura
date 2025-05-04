# PowerShell script to set up local MySQL database for Secura
# Usage: ./scripts/setup-local-db.ps1 [environment]
# Example: ./scripts/setup-local-db.ps1 development

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

# Load environment variables
$envContent = Get-Content $EnvFile
$envVars = @{}
foreach ($line in $envContent) {
    if ($line -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
    }
}

# Extract database configuration
$DB_USER = $envVars["DB_USER"]
$DB_PASSWORD = $envVars["DB_PASSWORD"]
$DB_NAME = $envVars["DB_NAME"]
$MYSQL_ROOT_PASSWORD = $envVars["MYSQL_ROOT_PASSWORD"]

Write-Host "Setting up MySQL database for $Environment environment..."
Write-Host "Database: $DB_NAME"
Write-Host "User: $DB_USER"

# Create SQL script for database setup
$sqlScript = @"
CREATE DATABASE IF NOT EXISTS $DB_NAME;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
"@

$tempSqlFile = "temp_db_setup.sql"
$sqlScript | Out-File -FilePath $tempSqlFile -Encoding utf8

try {
    # Check if MySQL is running
    $mysqlService = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue
    if ($null -eq $mysqlService) {
        Write-Warning "MySQL service not found. Make sure MySQL is installed and running."
    } elseif ($mysqlService.Status -ne "Running") {
        Write-Host "Starting MySQL service..."
        Start-Service $mysqlService
    }

    # Execute the SQL script
    Write-Host "Creating database and user..."
    # Always prompt for MySQL root password for security
Write-Host "MySQL connection requires your root password."
$promptPassword = Read-Host "Enter your MySQL root password"

try {
    # Use the provided password
    Get-Content $tempSqlFile | mysql -u root --password="$promptPassword"
    
    # If successful, update the environment variable for future use
    $MYSQL_ROOT_PASSWORD = $promptPassword
} catch {
    Write-Error "Failed to connect to MySQL: $_"
    exit 1
}

    # Run migrations if available
    if (Test-Path "backend\scripts\db-tools.js") {
        Write-Host "Running database migrations..."
        Push-Location backend
        npm run migrate
        Pop-Location
    }

    # Seed the database if in development or testing environment
    if ($Environment -eq "development" -or $Environment -eq "testing") {
        if (Test-Path "backend\scripts\db-tools.js") {
            Write-Host "Seeding the database with sample data..."
            Push-Location backend
            npm run seed
            Pop-Location
        }
    }

    Write-Host "Database setup completed successfully!" -ForegroundColor Green
} catch {
    Write-Error "Error setting up database: $_"
} finally {
    # Clean up temporary file
    if (Test-Path $tempSqlFile) {
        Remove-Item $tempSqlFile
    }
}
