#!/bin/bash
# Script to set up secrets for Secura environments
# Usage: ./setup-secrets.sh [dev|test|prod]

set -e

# Check if environment is provided
if [ $# -ne 1 ]; then
  echo "Usage: $0 [dev|test|prod]"
  exit 1
fi

ENV=$1

# Validate environment
if [[ "$ENV" != "dev" && "$ENV" != "test" && "$ENV" != "prod" ]]; then
  echo "Invalid environment. Must be one of: dev, test, prod"
  exit 1
fi

# Create secrets directory structure
mkdir -p ./secrets/$ENV

# Generate random secrets
echo "Generating secrets for $ENV environment..."

# JWT Secret (64 bytes)
openssl rand -base64 64 > ./secrets/$ENV/jwt_secret.txt

# Encryption Key (32 bytes - AES-256)
openssl rand -base64 32 > ./secrets/$ENV/encryption_key.txt

# Database Password (32 bytes)
openssl rand -base64 32 > ./secrets/$ENV/db_password.txt

# MySQL Root Password (32 bytes)
openssl rand -base64 32 > ./secrets/$ENV/mysql_root_password.txt

# Error Tracking Salt (16 bytes)
openssl rand -base64 16 > ./secrets/$ENV/error_tracking_salt.txt

# Additional secrets for production
if [ "$ENV" = "prod" ]; then
  # Admin emails
  echo "Enter admin email addresses (comma-separated):"
  read admin_emails
  echo "$admin_emails" > ./secrets/$ENV/admin_emails.txt
  
  # SMTP Password
  echo "Enter SMTP password:"
  read -s smtp_password
  echo "$smtp_password" > ./secrets/$ENV/smtp_password.txt
fi

# Set proper permissions
chmod 600 ./secrets/$ENV/*.txt

echo "Secrets generated successfully for $ENV environment."
echo "Make sure to keep these secrets secure and never commit them to version control."

# Create directories for certbot if production
if [ "$ENV" = "prod" ]; then
  mkdir -p ./certbot/conf
  mkdir -p ./certbot/www
  chmod -R 755 ./certbot
fi

echo "Setup complete!"
