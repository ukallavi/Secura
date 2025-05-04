#!/bin/bash
# Script to run all tests in the single container

set -e

# Start MySQL
echo "Starting MySQL server..."
service mysql start

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
while ! mysqladmin ping -h localhost -u root --silent; do
  sleep 1
done

# Set up test database
echo "Setting up test database..."
mysql -u root -e "CREATE DATABASE IF NOT EXISTS ${MYSQL_DATABASE:-secura_test};"
mysql -u root -e "CREATE USER IF NOT EXISTS '${MYSQL_USER:-secura_test}'@'localhost' IDENTIFIED BY '$(cat /run/secrets/db_password)';"
mysql -u root -e "GRANT ALL PRIVILEGES ON ${MYSQL_DATABASE:-secura_test}.* TO '${MYSQL_USER:-secura_test}'@'localhost';"
mysql -u root -e "FLUSH PRIVILEGES;"

# Run database migrations
echo "Running database migrations..."
cd /app/backend
npm run migrate

# Run backend tests
echo "Running backend tests..."
cd /app/backend
npm test

# Run frontend tests
echo "Running frontend tests..."
cd /app/frontend
npm test

echo "All tests completed!"
