// database/helpers/migrationHelpers.js
const { db } = require('../db');
const { logger } = require('../../backend/utils/logger');

/**
 * Adds standard timestamp columns (created_at, updated_at) to a table
 * @param {object} table - Knex table builder object
 */
function addTimestamps(table) {
  table.timestamp('created_at').defaultTo(db.fn.now());
  table.timestamp('updated_at').defaultTo(db.fn.now());
}

/**
 * Adds a standard ID column to a table
 * @param {object} table - Knex table builder object
 * @param {string} name - Column name (default: 'id')
 */
function addIdColumn(table, name = 'id') {
  table.increments(name).primary();
}

/**
 * Adds a foreign key column referencing the users table
 * @param {object} table - Knex table builder object
 * @param {string} columnName - Foreign key column name (default: 'user_id')
 * @param {boolean} nullable - Whether the column can be null (default: false)
 * @param {string} onDelete - On delete behavior (default: 'CASCADE')
 */
function addUserForeignKey(table, columnName = 'user_id', nullable = false, onDelete = 'CASCADE') {
  const column = table.integer(columnName).unsigned();
  
  if (!nullable) {
    column.notNullable();
  }
  
  column.references('id').inTable('users').onDelete(onDelete);
  table.index(columnName);
}

/**
 * Adds a full-text search index to specified columns
 * @param {string} tableName - Name of the table
 * @param {Array<string>} columns - Array of column names to include in the index
 * @param {string} indexName - Name of the index (default: `${tableName}_fulltext`)
 * @returns {Promise} - Promise resolving when the index is created
 */
async function addFullTextIndex(tableName, columns, indexName = `${tableName}_fulltext`) {
  try {
    logger.info(`Creating full-text index ${indexName} on ${tableName} (${columns.join(', ')})`);
    
    // Check if index already exists
    const indexExists = await db.schema.raw(`
      SELECT COUNT(*) as count 
      FROM information_schema.statistics 
      WHERE table_schema = DATABASE() 
      AND table_name = ? 
      AND index_name = ?
    `, [tableName, indexName])
      .then(result => result[0][0].count > 0);
    
    if (indexExists) {
      logger.info(`Index ${indexName} already exists, skipping creation`);
      return;
    }
    
    // Create the full-text index
    await db.schema.raw(`
      ALTER TABLE ${tableName} 
      ADD FULLTEXT INDEX ${indexName} (${columns.join(', ')})
    `);
    
    logger.info(`Created full-text index ${indexName} successfully`);
  } catch (error) {
    logger.error(`Failed to create full-text index ${indexName}:`, error);
    throw error;
  }
}

/**
 * Adds a JSON column with validation
 * @param {object} table - Knex table builder object
 * @param {string} columnName - Name of the JSON column
 * @param {boolean} nullable - Whether the column can be null (default: true)
 */
function addJsonColumn(table, columnName, nullable = true) {
  const column = table.json(columnName);
  
  if (!nullable) {
    column.notNullable();
  }
  
  // Add check constraint to ensure valid JSON (MySQL 8.0.17+)
  table.raw(`
    ADD CONSTRAINT ${table._tableName}_${columnName}_valid_json 
    CHECK (JSON_VALID(${columnName}) OR ${columnName} IS NULL)
  `);
}

module.exports = {
  addTimestamps,
  addIdColumn,
  addUserForeignKey,
  addFullTextIndex,
  addJsonColumn
};