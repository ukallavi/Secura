// tests/setup.js
const { db, runMigrations, rollbackMigrations, runSeeds } = require('../database/db');
const { logger } = require('../backend/utils/logger');

// Disable logging during tests
logger.level = 'error';

// Setup function to run before all tests
async function setupTestDatabase() {
    try {
      // Roll back any existing migrations
      await rollbackMigrations(true);
      
      // Run migrations
      await runMigrations();
      
      // Run seed data
      await runSeeds();
      
      console.log('Test database setup complete');
    } catch (error) {
      console.error('Test database setup failed:', error);
      process.exit(1);
    }
  }
  
  // Teardown function to run after all tests
  async function teardownTestDatabase() {
    try {
      // Roll back migrations
      await rollbackMigrations(true);
      
      // Close database connection
      await db.destroy();
      
      console.log('Test database teardown complete');
    } catch (error) {
      console.error('Test database teardown failed:', error);
      process.exit(1);
    }
  }
  
  // Export setup and teardown functions
  module.exports = {
    setupTestDatabase,
    teardownTestDatabase
  };