#!/bin/bash
# generate-certs.sh

# Create directories for certificates
mkdir -p certs/dev
mkdir -p certs/staging
mkdir -p certs/production

# Generate development certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/dev/privkey.pem \
  -out certs/dev/fullchain.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

echo "Development certificates generated."
echo "For production, use Let's Encrypt or a commercial SSL provider."
echo "For staging, you can use Let's Encrypt staging environment."
