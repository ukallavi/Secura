// database/models/User.js
const BaseModel = require('./BaseModel');
const { logger } = require('../../backend/utils/logger');
const bcrypt = require('bcrypt');

class User extends BaseModel {
  constructor() {
    super('users');
  }

  /**
   * Find a user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} - User object or null
   */
  async findByEmail(email) {
    try {
      return await this.getByField('email', email);
    } catch (error) {
      logger.error('Error in User.findByEmail:', error);
      throw error;
    }
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<number>} - New user ID
   */
  async createUser(userData) {
    try {
      // Hash password
      if (userData.password) {
        const salt = await bcrypt.genSalt(10);
        userData.password = await bcrypt.hash(userData.password, salt);
      }

      // Set default values
      const newUser = {
        ...userData,
        status: userData.status || 'active',
        role: userData.role || 'user',
        created_at: this.db.fn.now(),
        updated_at: this.db.fn.now()
      };

      return await this.create(newUser);
    } catch (error) {
      logger.error('Error in User.createUser:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {number} userId - User ID
   * @param {Object} userData - User data to update
   * @returns {Promise<number>} - Number of affected rows
   */
  async updateUser(userId, userData) {
    try {
      // Don't allow updating sensitive fields directly
      const { password, role, ...safeData } = userData;
      
      return await this.update(userId, safeData);
    } catch (error) {
      logger.error('Error in User.updateUser:', error);
      throw error;
    }
  }

  /**
   * Change user password
   * @param {number} userId - User ID
   * @param {string} newPassword - New password (plaintext)
   * @returns {Promise<boolean>} - Success status
   */
  async changePassword(userId, newPassword) {
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      const updated = await this.update(userId, { 
        password: hashedPassword,
        password_changed_at: this.db.fn.now()
      });
      
      return updated > 0;
    } catch (error) {
      logger.error('Error in User.changePassword:', error);
      throw error;
    }
  }

  /**
   * Verify user password
   * @param {string} plainPassword - Plain text password
   * @param {string} hashedPassword - Hashed password from database
   * @returns {Promise<boolean>} - Whether password matches
   */
  async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      logger.error('Error in User.verifyPassword:', error);
      throw error;
    }
  }

  /**
   * Get users with pagination
   * @param {Object} options - Pagination and filter options
   * @returns {Promise<Object>} - Paginated results
   */
  async getUsers({ page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', filters = {} }) {
    try {
      const offset = (page - 1) * limit;
      
      // Build query
      const query = this.db(this.tableName)
        .select('id', 'email', 'role', 'status', 'created_at', 'updated_at', 'last_login_at')
        .orderBy(sortBy, sortOrder)
        .limit(limit)
        .offset(offset);
      
      // Apply filters
      if (filters.role) {
        query.where('role', filters.role);
      }
      
      if (filters.status) {
        query.where('status', filters.status);
      }
      
      if (filters.search) {
        query.where('email', 'like', `%${filters.search}%`);
      }
      
      // Execute query
      const users = await query;
      
      // Get total count for pagination
      const totalQuery = this.db(this.tableName).count('* as count');
      
      // Apply the same filters to the count query
      if (filters.role) {
        totalQuery.where('role', filters.role);
      }
      
      if (filters.status) {
        totalQuery.where('status', filters.status);
      }
      
      if (filters.search) {
        totalQuery.where('email', 'like', `%${filters.search}%`);
      }
      
      const [{ count }] = await totalQuery;
      
      return {
        users,
        pagination: {
          total: parseInt(count, 10),
          page,
          limit,
          pages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('Error in User.getUsers:', error);
      throw error;
    }
  }

  /**
   * Deactivate user account
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async deactivateUser(userId) {
    try {
      const updated = await this.update(userId, { 
        status: 'inactive',
        deactivated_at: this.db.fn.now() 
      });
      
      return updated > 0;
    } catch (error) {
      logger.error('Error in User.deactivateUser:', error);
      throw error;
    }
  }

  /**
   * Reactivate user account
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async reactivateUser(userId) {
    try {
      const updated = await this.update(userId, { 
        status: 'active',
        deactivated_at: null 
      });
      
      return updated > 0;
    } catch (error) {
      logger.error('Error in User.reactivateUser:', error);
      throw error;
    }
  }

  /**
   * Update user's last login timestamp
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async updateLastLogin(userId) {
    try {
      const updated = await this.update(userId, { 
        last_login_at: this.db.fn.now() 
      });
      
      return updated > 0;
    } catch (error) {
      logger.error('Error in User.updateLastLogin:', error);
      throw error;
    }
  }
}

// Create singleton instance
const userModel = new User();

module.exports = userModel;