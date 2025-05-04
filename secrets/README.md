# Secura Secrets

This directory contains sensitive configuration files that should never be committed to version control.

## Secret Files

- `jwt_secret.txt`: Secret key used for JWT token signing
- `encryption_key.txt`: Key used for encrypting sensitive data
- `db_password.txt`: Database user password
- `db_root_password.txt`: Database root password
- `error_tracking_salt.txt`: Salt used for anonymizing user IDs in error tracking
- `db_init.sql`: SQL script with sensitive initialization commands

## Production Setup

For production, replace these files with actual secrets and ensure proper permissions:

```bash
# Generate strong random secrets
openssl rand -base64 32 > jwt_secret.txt
openssl rand -base64 32 > encryption_key.txt
openssl rand -base64 24 > db_password.txt
openssl rand -base64 32 > db_root_password.txt
openssl rand -base64 32 > error_tracking_salt.txt

# Set proper permissions
chmod 600 *.txt
```

## Security Notes

1. In production environments, consider using a dedicated secrets management solution like:
   - Docker Swarm secrets
   - Kubernetes secrets
   - HashiCorp Vault
   - AWS Secrets Manager
   - Azure Key Vault

2. Rotate these secrets regularly according to your security policy

3. Ensure backups of these secrets are securely stored
