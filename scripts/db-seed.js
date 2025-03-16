// scripts/db-seed.js
const { runSeeds, closeDatabase } = require('../database/db');
const { logger } = require('../backend/utils/logger');

async function main() {
  try {
    logger.info('Starting database seed process...');
    await runSeeds();
    logger.info('Database seed completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database seed failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

main();