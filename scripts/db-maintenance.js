// scripts/db-maintenance.js
const { 
    db, 
    checkDatabaseConnection, 
    runMigrations, 
    rollbackMigrations, 
    getMigrationStatus,
    runSeeds,
    closeDatabase,
    getDatabaseHealth 
  } = require('../database/db');
  const { logger } = require('../backend/utils/logger');
  
  // Command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  async function main() {
    try {
      // Check connection
      const connected = await checkDatabaseConnection();
      if (!connected) {
        logger.error('Cannot connect to database, aborting');
        process.exit(1);
      }
  
      // Execute the requested command
      switch (command) {
        case 'health':
          const health = await getDatabaseHealth();
          console.log(JSON.stringify(health, null, 2));
          break;
          
        case 'migrate':
          await runMigrations();
          break;
          
        case 'rollback':
          const all = args[1] === 'all';
          await rollbackMigrations(all);
          break;
          
        case 'status':
          const status = await getMigrationStatus();
          console.log(JSON.stringify(status, null, 2));
          break;
          
        case 'seed':
          await runSeeds();
          break;
          
        case 'optimize':
          logger.info('Optimizing database tables...');
          const tables = await db.raw('SHOW TABLES');
          const tableNames = tables[0].map(table => Object.values(table)[0]);
          
          for (const table of tableNames) {
            logger.info(`Optimizing table: ${table}`);
            await db.raw(`OPTIMIZE TABLE ${table}`);
          }
          logger.info('Database optimization completed');
          break;
          
        case 'analyze':
          logger.info('Analyzing database tables...');
          const allTables = await db.raw('SHOW TABLES');
          const allTableNames = allTables[0].map(table => Object.values(table)[0]);
          
          for (const table of allTableNames) {
            logger.info(`Analyzing table: ${table}`);
            await db.raw(`ANALYZE TABLE ${table}`);
          }
          logger.info('Database analysis completed');
          break;
          
        default:
          console.log(`
  Available commands:
    health    - Show database health status
    migrate   - Run pending migrations
    rollback [all] - Rollback last batch of migrations (or all)
    status    - Show migration status
    seed      - Run seed files
    optimize  - Optimize database tables
    analyze   - Analyze database tables
          `);
          break;
      }
    } catch (error) {
      logger.error('Error in database maintenance:', error);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  }
  
  main();