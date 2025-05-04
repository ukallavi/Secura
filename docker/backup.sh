#!/bin/bash
# Script to backup MySQL database in the single container

set -e

# Get current date for backup filename
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="/app/backups"
BACKUP_FILE="${BACKUP_DIR}/secura_backup_${DATE}.sql.gz"

# Ensure backup directory exists
mkdir -p ${BACKUP_DIR}

echo "Starting database backup at $(date)"

# Get database password from secrets
DB_PASSWORD=$(cat /run/secrets/db_password)

# Dump database and compress
mysqldump -h localhost -u ${MYSQL_USER} -p${DB_PASSWORD} ${MYSQL_DATABASE} | gzip > ${BACKUP_FILE}

echo "Backup completed: ${BACKUP_FILE}"

# Clean up old backups
if [ -n "${BACKUP_RETENTION_DAYS}" ] && [ "${BACKUP_RETENTION_DAYS}" -gt 0 ]; then
  echo "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days"
  find ${BACKUP_DIR} -name "secura_backup_*.sql.gz" -type f -mtime +${BACKUP_RETENTION_DAYS} -delete
fi

echo "Backup process completed at $(date)"
