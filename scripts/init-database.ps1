# Initialize database and run migrations
Write-Host "Initializing Secura database..." -ForegroundColor Cyan

# Set environment variables if not already set
if (-not $env:DB_HOST) { $env:DB_HOST = "localhost" }
if (-not $env:DB_USER) { $env:DB_USER = "root" }
if (-not $env:DB_PASSWORD) { $env:DB_PASSWORD = "" }
if (-not $env:DB_NAME) { $env:DB_NAME = "secura_dev" }

# Create database if it doesn't exist
Write-Host "Creating database if it doesn't exist..." -ForegroundColor Yellow
$createDbSql = "CREATE DATABASE IF NOT EXISTS $env:DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Execute the SQL using mysql command
mysql -h $env:DB_HOST -u $env:DB_USER --password=$env:DB_PASSWORD -e $createDbSql

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create database. Please check your MySQL connection settings." -ForegroundColor Red
    exit 1
}

# Change to database directory
Push-Location -Path "$PSScriptRoot\..\database"

try {
    # Install dependencies if needed
    Write-Host "Installing database dependencies..." -ForegroundColor Yellow
    npm install

    # Run migrations
    Write-Host "Running database migrations..." -ForegroundColor Yellow
    npx knex migrate:latest
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migrations completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Migration failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    # Run seeds for development environment
    if ($env:NODE_ENV -ne "production") {
        Write-Host "Running development seeds..." -ForegroundColor Yellow
        npx knex seed:run
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Seeds completed successfully!" -ForegroundColor Green
        } else {
            Write-Host "Seeds failed with exit code $LASTEXITCODE" -ForegroundColor Red
            # Don't exit on seed failure, as it's not critical
        }
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
} finally {
    # Restore original directory
    Pop-Location
}

Write-Host "Database initialization complete!" -ForegroundColor Green
