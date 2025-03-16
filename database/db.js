// database/db.js
const knex = require('knex');
const config = require('../knexfile');
const { logger } = require('../backend/utils/logger');

// Get environment
const environment = process.env.NODE_ENV || 'development';

// Create database connection with optimized pool settings
const db = knex({
  ...config[environment],
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
    propagateCreateError: false
  }
});

// Add connection monitoring
db.on('query', (query) => {
  if (process.env.KNEX_DEBUG === 'true') {
    logger.debug('Query:', query.sql, query.bindings);
  }
});

db.on('error', (err) => {
  logger.error('Database error:', err);
});

// Check database connection
async function checkDatabaseConnection() {
  try {
    await db.raw('SELECT 1');
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown
async function closeDatabase() {
  try {
    logger.info('Closing database connections...');
    await db.destroy();
    logger.info('Database connections closed successfully');
    return true;
  } catch (error) {
    logger.error('Error closing database connections:', error);
    return false;
  }
}

// Get database health status
async function getDatabaseHealth() {
  try {
    const start = Date.now();
    await db.raw('SELECT 1');
    const responseTime = Date.now() - start;
    const pool = db.client.pool;
    
    return {
      status: 'connected',
      responseTime: `${responseTime}ms`,
      pool: {
        min: pool.min,
        max: pool.max,
        free: pool.numFree(),
        used: pool.numUsed(),
        pending: pool.numPendingAcquires(),
        total: pool.numUsed() + pool.numFree()
      }
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'error',
      error: error.message
    };
  }
}

// Transaction helper
async function withTransaction(callback) {
  const trx = await db.transaction();
  
  try {
    const result = await callback(trx);
    await trx.commit();
    return result;
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}

// Run migrations
async function runMigrations() {
  try {
    logger.info('Running database migrations...');
    const migrations = await db.migrate.latest();
    logger.info('Migrations completed:', migrations);
    return migrations;
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Rollback migrations
async function rollbackMigrations(all = false) {
  try {
    logger.info(`Rolling back migrations${all ? ' (all)' : ''}...`);
    const rollback = all ? 
      await db.migrate.rollback({}, true) : 
      await db.migrate.rollback();
    logger.info('Rollback completed:', rollback);
    return rollback;
  } catch (error) {
    logger.error('Rollback failed:', error);
    throw error;
  }
}

// Get migration status
async function getMigrationStatus() {
  try {
    logger.info('Checking migration status...');
    const status = await db.migrate.status();
    logger.info('Migration status:', status);
    return status;
  } catch (error) {
    logger.error('Failed to get migration status:', error);
    throw error;
  }
}

// Run seed files
async function runSeeds() {
  try {
    logger.info('Running seed files...');
    const seeds = await db.seed.run();
    logger.info('Seeds completed:', seeds);
    return seeds;
  } catch (error) {
    logger.error('Seeding failed:', error);
    throw error;
  }
}

// Additional utility methods

/**
 * Execute a raw SQL query with error handling
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
async function executeQuery(sql, params = []) {
  try {
    const results = await db.raw(sql, params);
    return results[0];
  } catch (error) {
    logger.error('Database query error:', error);
    throw error;
  }
}

/**
 * Insert a record into a table
 * @param {string} table - Table name
 * @param {Object} data - Data to insert
 * @param {Object} [trx] - Optional transaction object
 * @returns {Promise<number>} Inserted record ID
 */
async function insert(table, data, trx = db) {
  try {
    const result = await trx(table).insert(data);
    return result[0]; // Return inserted ID
  } catch (error) {
    logger.error(`Error inserting into ${table}:`, error);
    throw error;
  }
}

/**
 * Update records in a table
 * @param {string} table - Table name
 * @param {Object} data - Data to update
 * @param {Object} where - Where conditions
 * @param {Object} [trx] - Optional transaction object
 * @returns {Promise<number>} Number of updated rows
 */
async function update(table, data, where, trx = db) {
  try {
    return await trx(table).where(where).update(data);
  } catch (error) {
    logger.error(`Error updating ${table}:`, error);
    throw error;
  }
}

/**
 * Delete records from a table
 * @param {string} table - Table name
 * @param {Object} where - Where conditions
 * @param {Object} [trx] - Optional transaction object
 * @returns {Promise<number>} Number of deleted rows
 */
async function remove(table, where, trx = db) {
  try {
    return await trx(table).where(where).delete();
  } catch (error) {
    logger.error(`Error deleting from ${table}:`, error);
    throw error;
  }
}

/**
 * Find a single record
 * @param {string} table - Table name
 * @param {Object} where - Where conditions
 * @param {Array} [columns] - Columns to select
 * @param {Object} [trx] - Optional transaction object
 * @returns {Promise<Object>} Found record or null
 */
async function findOne(table, where, columns = ['*'], trx = db) {
  try {
    return await trx(table).select(...columns).where(where).first();
  } catch (error) {
    logger.error(`Error finding record in ${table}:`, error);
    throw error;
  }
}

/**
 * Find multiple records
 * @param {string} table - Table name
 * @param {Object} where - Where conditions
 * @param {Array} [columns] - Columns to select
 * @param {Object} [options] - Additional options (orderBy, limit, offset)
 * @param {Object} [trx] - Optional transaction object
 * @returns {Promise<Array>} Found records
 */
async function findMany(table, where = {}, columns = ['*'], options = {}, trx = db) {
  try {
    let query = trx(table).select(...columns).where(where);
    
    // Apply ordering if specified
    if (options.orderBy) {
      if (Array.isArray(options.orderBy)) {
        for (const [column, direction] of options.orderBy) {
          query = query.orderBy(column, direction || 'asc');
        }
      } else {
        query = query.orderBy(options.orderBy, options.orderDirection || 'asc');
      }
    }
    
    // Apply pagination if specified
    if (options.limit) {
      query = query.limit(options.limit);
      
      if (options.offset || options.offset === 0) {
        query = query.offset(options.offset);
      }
    }
    
    return await query;
  } catch (error) {
    logger.error(`Error finding records in ${table}:`, error);
    throw error;
  }
}

/**
 * Count records in a table
 * @param {string} table - Table name
 * @param {Object} where - Where conditions
 * @param {Object} [trx] - Optional transaction object
 * @returns {Promise<number>} Count of records
 */
async function count(table, where = {}, trx = db) {
  try {
    const result = await trx(table).where(where).count('* as count').first();
    return parseInt(result.count);
  } catch (error) {
    logger.error(`Error counting records in ${table}:`, error);
    throw error;
  }
}

/**
 * Check if a record exists
 * @param {string} table - Table name
 * @param {Object} where - Where conditions
 * @param {Object} [trx] - Optional transaction object
 * @returns {Promise<boolean>} Whether the record exists
 */
async function exists(table, where, trx = db) {
  try {
    const result = await trx(table).where(where).select(1).first();
    return !!result;
  } catch (error) {
    logger.error(`Error checking existence in ${table}:`, error);
    throw error;
  }
}

/**
 * Insert or update a record (upsert)
 * @param {string} table - Table name
 * @param {Object} data - Data to insert/update
 * @param {Array|string} uniqueKeys - Unique key(s) for conflict resolution
 * @param {Object} [trx] - Optional transaction object
 * @returns {Promise<number>} Inserted/updated record ID
 */
async function upsert(table, data, uniqueKeys, trx = db) {
  try {
    // For MySQL
    if (db.client.config.client === 'mysql' || db.client.config.client === 'mysql2') {
      const result = await trx(table)
        .insert(data)
        .onConflict(uniqueKeys)
        .merge();
      return result[0];
    }
    
    // For PostgreSQL
    if (db.client.config.client === 'pg' || db.client.config.client === 'postgres') {
      const result = await trx(table)
        .insert(data)
        .onConflict(uniqueKeys)
        .merge();
      return result[0];
    }
    
    // For SQLite
    if (db.client.config.client === 'sqlite3') {
      const result = await trx(table)
        .insert(data)
        .onConflict(uniqueKeys)
        .merge();
      return result[0];
    }
    
    throw new Error(`Upsert not implemented for database client: ${db.client.config.client}`);
  } catch (error) {
    logger.error(`Error upserting into ${table}:`, error);
    throw error;
  }
}

/**
 * Execute a batch insert
 * @param {string} table - Table name
 * @param {Array} rows - Array of row objects to insert
 * @param {Object} [options] - Options (batchSize, returning)
 * @param {Object} [trx] - Optional transaction object
 * @returns {Promise<Array>} Result of the batch insert
 */
async function batchInsert(table, rows, options = { batchSize: 100 }, trx = db) {
  try {
    if (!rows.length) return [];
    
    const result = await db.batchInsert(table, rows, options.batchSize)
      .transacting(trx || null);
    
    return result;
  } catch (error) {
    logger.error(`Error batch inserting into ${table}:`, error);
    throw error;
  }
}

/**
 * Execute a database operation with retries
 * @param {Function} operation - Function to execute
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Result of the operation
 */
async function withRetry(operation, options = {}) {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 1000;
  const retryableErrors = options.retryableErrors || ['ECONNRESET', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST'];
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const errorCode = error.code || '';
      const isRetryable = retryableErrors.some(code => errorCode.includes(code));
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      logger.warn(`Retryable error (attempt ${attempt}/${maxRetries}):`, error);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }
  
  throw lastError;
}

// Export the database instance and utility functions
module.exports = {
  db,
  checkDatabaseConnection,
  closeDatabase,
  getDatabaseHealth,
  withTransaction,
  runMigrations,
  rollbackMigrations,
  getMigrationStatus,
  runSeeds,
  executeQuery,
  insert,
  update,
  remove,
  findOne,
  findMany,
  count,
  exists,
  upsert,
  batchInsert,
  withRetry
};