// database/models/BaseModel.js
const { db } = require('../db');
const { logger } = require('../../backend/utils/logger');

/**
 * Base model class that provides common functionality for all models
 */
class BaseModel {
  /**
   * Create a new model instance
   * @param {string} tableName - The name of the database table
   */
  constructor(tableName) {
    this.tableName = tableName;
    this.db = db;
  }

  /**
   * Get all records from the table
   * @param {Object} options - Query options (limit, offset, orderBy)
   * @returns {Promise<Array>} - Array of records
   */
  async getAll(options = {}) {
    try {
      const { 
        limit = 100, 
        offset = 0, 
        orderBy = 'id', 
        order = 'asc' 
      } = options;

      return await this.db(this.tableName)
        .limit(limit)
        .offset(offset)
        .orderBy(orderBy, order);
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.getAll:`, error);
      throw error;
    }
  }

  /**
   * Get a record by ID
   * @param {number|string} id - Record ID
   * @returns {Promise<Object>} - Record object
   */
  async getById(id) {
    try {
      return await this.db(this.tableName)
        .where({ id })
        .first();
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.getById:`, error);
      throw error;
    }
  }

  /**
   * Get records by a specific field value
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @returns {Promise<Array>} - Array of matching records
   */
  async getByField(field, value) {
    try {
      return await this.db(this.tableName)
        .where({ [field]: value });
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.getByField:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   * @param {Object} data - Record data
   * @returns {Promise<number|string>} - ID of the new record
   */
  async create(data) {
    try {
      const [id] = await this.db(this.tableName).insert(data);
      return id;
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.create:`, error);
      throw error;
    }
  }

  /**
   * Update a record
   * @param {number|string} id - Record ID
   * @param {Object} data - Updated data
   * @returns {Promise<number>} - Number of affected rows
   */
  async update(id, data) {
    try {
      return await this.db(this.tableName)
        .where({ id })
        .update(data);
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.update:`, error);
      throw error;
    }
  }

  /**
   * Delete a record
   * @param {number|string} id - Record ID
   * @returns {Promise<number>} - Number of affected rows
   */
  async delete(id) {
    try {
      return await this.db(this.tableName)
        .where({ id })
        .delete();
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.delete:`, error);
      throw error;
    }
  }

  /**
   * Check if a record exists
   * @param {number|string} id - Record ID
   * @returns {Promise<boolean>} - True if record exists
   */
  async exists(id) {
    try {
      const result = await this.db(this.tableName)
        .where({ id })
        .first('id');
      return !!result;
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.exists:`, error);
      throw error;
    }
  }

  /**
   * Count records with optional filtering
   * @param {Object} filters - Filter conditions
   * @returns {Promise<number>} - Count of records
   */
  async count(filters = {}) {
    try {
      const result = await this.db(this.tableName)
        .where(filters)
        .count('id as count')
        .first();
      return Number(result.count);
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.count:`, error);
      throw error;
    }
  }

  /**
   * Run a raw query
   * @param {string} query - Raw SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} - Query results
   */
  async raw(query, params = []) {
    try {
      return await this.db.raw(query, params);
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.raw:`, error);
      throw error;
    }
  }

  /**
   * Begin a transaction
   * @returns {Promise<Object>} - Knex transaction object
   */
  async beginTransaction() {
    return await this.db.transaction();
  }

  /**
   * Execute a function within a transaction
   * @param {Function} callback - Function to execute within transaction
   * @returns {Promise<any>} - Result of callback
   */
  async withTransaction(callback) {
    try {
      return await this.db.transaction(trx => callback(trx));
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.withTransaction:`, error);
      throw error;
    }
  }

  /**
   * Search records by a text field
   * @param {string} field - Field to search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Matching records
   */
  async search(field, query, options = {}) {
    try {
      const { 
        limit = 50, 
        offset = 0, 
        orderBy = 'id', 
        order = 'asc',
        additionalFilters = {}
      } = options;

      return await this.db(this.tableName)
        .where(additionalFilters)
        .whereRaw(`LOWER(${field}) LIKE ?`, [`%${query.toLowerCase()}%`])
        .limit(limit)
        .offset(offset)
        .orderBy(orderBy, order);
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.search:`, error);
      throw error;
    }
  }

  /**
   * Insert multiple records at once
   * @param {Array<Object>} records - Array of record data
   * @returns {Promise<Array>} - Array of inserted IDs
   */
  async bulkInsert(records) {
    try {
      return await this.db(this.tableName).insert(records);
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.bulkInsert:`, error);
      throw error;
    }
  }

  /**
   * Update multiple records that match a condition
   * @param {Object} conditions - Where conditions
   * @param {Object} data - Data to update
   * @returns {Promise<number>} - Number of affected rows
   */
  async bulkUpdate(conditions, data) {
    try {
      return await this.db(this.tableName)
        .where(conditions)
        .update(data);
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.bulkUpdate:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple records that match a condition
   * @param {Object} conditions - Where conditions
   * @returns {Promise<number>} - Number of affected rows
   */
  async bulkDelete(conditions) {
    try {
      return await this.db(this.tableName)
        .where(conditions)
        .delete();
    } catch (error) {
      logger.error(`Error in ${this.constructor.name}.bulkDelete:`, error);
      throw error;
    }
  }
}

module.exports = BaseModel;