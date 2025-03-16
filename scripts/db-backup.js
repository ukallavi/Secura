// scripts/db-backup.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { db, getDatabaseHealth, closeDatabase } = require('../database/db');
const { logger } = require('../backend/utils/logger');
const config = require('../knexfile');

const execPromise = util.promisify(exec);
const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

// Create backup directory if it doesn't exist
const backupDir = path.join(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Generate backup filename with timestamp
const getBackupFileName = () => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  return `secura_backup_${environment}_${timestamp}.sql`;
};

async function backupDatabase() {
  try {
    // Check database health before backup
    const health = await getDatabaseHealth();
    if (health.status !== 'connected') {
      throw new Error(`Database is not healthy: ${JSON.stringify(health)}`);
    }

    const backupFile = path.join(backupDir, getBackupFileName());
    logger.info(`Starting database backup to ${backupFile}`);

    // Build mysqldump command
    const { host, user, password, database } = dbConfig.connection;
    const mysqldumpCmd = `mysqldump --host=${host} --user=${user} ${password ? `--password=${password}` : ''} ${database} > "${backupFile}"`;
    
    // Execute mysqldump
    await execPromise(mysqldumpCmd);
    
    // Compress the backup
    logger.info('Compressing backup file...');
    await execPromise(`gzip "${backupFile}"`);
    
    logger.info(`Database backup completed: ${backupFile}.gz`);
    
    // Delete old backups (keep last 10)
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('secura_backup_') && file.endsWith('.sql.gz'))
      .sort((a, b) => fs.statSync(path.join(backupDir, b)).mtime.getTime() - 
                      fs.statSync(path.join(backupDir, a)).mtime.getTime());
    
    if (files.length > 10) {
      const filesToDelete = files.slice(10);
      for (const file of filesToDelete) {
        logger.info(`Deleting old backup: ${file}`);
        fs.unlinkSync(path.join(backupDir, file));
      }
    }
    
    return `${backupFile}.gz`;
  } catch (error) {
    logger.error('Database backup failed:', error);
    throw error;
  } finally {
    await closeDatabase();
  }
}

// Restore database from backup
async function restoreDatabase(backupFile) {
  try {
    if (!backupFile) {
      throw new Error('Backup file path is required');
    }
    
    logger.info(`Starting database restore from ${backupFile}`);
    
    // Check if file exists
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }
    
    // Decompress if it's a .gz file
    let sqlFile = backupFile;
    if (backupFile.endsWith('.gz')) {
      logger.info('Decompressing backup file...');
      await execPromise(`gunzip -c "${backupFile}" > "${backupFile.slice(0, -3)}"`);
      sqlFile = backupFile.slice(0, -3);
    }
    
    // Build mysql command
    const { host, user, password, database } = dbConfig.connection;
    const mysqlCmd = `mysql --host=${host} --user=${user} ${password ? `--password=${password}` : ''} ${database} < "${sqlFile}"`;
    
    // Execute mysql
    await execPromise(mysqlCmd);
    
    // Clean up temporary SQL file if we decompressed
    if (sqlFile !== backupFile) {
      fs.unlinkSync(sqlFile);
    }
    
    logger.info('Database restore completed successfully');
    return true;
  } catch (error) {
    logger.error('Database restore failed:', error);
    throw error;
  } finally {
    await closeDatabase();
  }
}

// Run as script if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'backup') {
    backupDatabase()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else if (command === 'restore') {
    const backupFile = args[1];
    if (!backupFile) {
      console.error('Error: Backup file path is required');
      console.log('Usage: node db-backup.js restore <backup-file-path>');
      process.exit(1);
    }
    
    restoreDatabase(backupFile)
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    console.log(`
Database Backup and Restore Utility

Usage:
  node db-backup.js backup              Create a new database backup
  node db-backup.js restore <file-path> Restore database from backup file
    `);
  }
} else {
  // Export functions for use as a module
  module.exports = {
    backupDatabase,
    restoreDatabase
  };
}