#!/bin/bash
# Script to initialize the database in a Docker container
# This script is meant to be run inside the Docker container

set -e

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
while ! mysqladmin ping -h"localhost" --silent; do
    sleep 1
done

echo "MySQL is ready. Initializing database..."

# Create database and user if they don't exist
mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME};
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

# Run migrations if available
if [ -f "/app/backend/scripts/db-tools.js" ]; then
    echo "Running database migrations..."
    cd /app/backend
    npm run migrate
    
    # Seed the database if in development or testing environment
    if [ "$NODE_ENV" = "development" ] || [ "$NODE_ENV" = "test" ]; then
        echo "Seeding the database with sample data..."
        npm run seed
    fi
fi

echo "Database initialization completed successfully!"
