// database/reset-db.js
/**
 * Script to reset the database by dropping all tables and running migrations
 */
const { db } = require('./db');
const knex = require('knex');
const config = require('./knexfile');
const logger = require('../backend/utils/logger');

async function resetDatabase() {
  try {
    console.log('Starting database reset...');
    
    // Get the current environment
    const env = process.env.NODE_ENV || 'development';
    console.log(`Using environment: ${env}`);
    
    // Create a new knex instance
    const knexInstance = knex(config[env]);
    
    // Drop all tables
    console.log('Dropping all tables...');
    await knexInstance.raw('SET FOREIGN_KEY_CHECKS = 0');
    
    // Get all tables
    const tables = await knexInstance.raw('SHOW TABLES');
    const tableNames = tables[0].map(table => Object.values(table)[0]);
    
    // Drop each table
    for (const tableName of tableNames) {
      console.log(`Dropping table: ${tableName}`);
      await knexInstance.schema.dropTableIfExists(tableName);
    }
    
    await knexInstance.raw('SET FOREIGN_KEY_CHECKS = 1');
    console.log('All tables dropped successfully');
    
    // Run migrations
    console.log('Running migrations...');
    await knexInstance.migrate.latest();
    console.log('Migrations completed successfully');
    
    // Close the connection
    await knexInstance.destroy();
    console.log('Database reset completed successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  }
}

// Run the function
resetDatabase();
