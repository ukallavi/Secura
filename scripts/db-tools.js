// scripts/db-tools.js
const { program } = require('commander');
const knex = require('knex');
const config = require('../knexfile');
const { logger } = require('../backend/utils/logger');

// Initialize knex with environment config
const environment = process.env.NODE_ENV || 'development';
const db = knex(config[environment]);

// Run migrations
async function runMigrations() {
  try {
    logger.info(`Running migrations for ${environment} environment...`);
    const [batchNo, log] = await db.migrate.latest();
    
    if (log.length === 0) {
      logger.info('Database already up to date');
    } else {
      logger.info(`Batch ${batchNo} run: ${log.length} migrations`);
      logger.info('Migrations:', log);
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

// Rollback migrations
async function rollbackMigrations(all) {
  try {
    if (all) {
      logger.info('Rolling back all migrations...');
      const [batchNo, log] = await db.migrate.rollback(undefined, true);
      logger.info(`Rolled back ${log.length} migrations`);
    } else {
      logger.info('Rolling back last batch of migrations...');
      const [batchNo, log] = await db.migrate.rollback();
      
      if (log.length === 0) {
        logger.info('No migrations to rollback');
      } else {
        logger.info(`Batch ${batchNo} rolled back: ${log.length} migrations`);
        logger.info('Rolled back:', log);
      }
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Rollback failed:', error);
    process.exit(1);
  }
}

// Run seeds
async function runSeeds() {
  try {
    logger.info(`Running seeds for ${environment} environment...`);
    await db.seed.run();
    logger.info('Seeds completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Check migration status
async function checkMigrationStatus() {
  try {
    logger.info('Checking migration status...');
    const [pending, completed] = await db.migrate.list();
    
    logger.info('Completed migrations:');
    completed.forEach(file => logger.info(`- ${file}`));
    
    logger.info('\nPending migrations:');
    if (pending.length === 0) {
      logger.info('- None');
    } else {
      pending.forEach(file => logger.info(`- ${file}`));
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Failed to check migration status:', error);
    process.exit(1);
  }
}

// Define CLI commands
program
  .version('1.0.0')
  .description('Secura Database Tools');

program
  .command('migrate')
  .description('Run all pending migrations')
  .action(runMigrations);

program
  .command('rollback')
  .description('Rollback the last batch of migrations')
  .option('--all', 'Rollback all migrations')
  .action((options) => rollbackMigrations(options.all));

program
  .command('seed')
  .description('Run seed files')
  .action(runSeeds);

program
  .command('status')
  .description('Check migration status')
  .action(checkMigrationStatus);

program.parse(process.argv);