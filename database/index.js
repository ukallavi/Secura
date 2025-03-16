// database/index.js
const { 
    db, 
    withTransaction,
    checkDatabaseConnection,
    closeDatabase,
    getDatabaseHealth,
    runMigrations,
    rollbackMigrations,
    getMigrationStatus,
    runSeeds
  } = require('./db');
  
  // Export all database-related functionality
  module.exports = {
    db,
    withTransaction,
    checkDatabaseConnection,
    closeDatabase,
    getDatabaseHealth,
    runMigrations,
    rollbackMigrations,
    getMigrationStatus,
    runSeeds
  };