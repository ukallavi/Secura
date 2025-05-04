// database/models/ActivityLog.js
const BaseModel = require('./BaseModel');
const { v4: uuidv4 } = require('uuid');

class ActivityLog extends BaseModel {
  static get tableName() {
    return 'activity_logs';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['user_id', 'action'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        user_id: { type: 'string' },
        action: { type: 'string' },
        details: { type: ['object', 'null'] },
        ip_address: { type: ['string', 'null'] },
        user_agent: { type: ['string', 'null'] },
        created_at: { type: 'string', format: 'date-time' }
      }
    };
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = this.id || uuidv4();
    this.timestamp = this.timestamp || new Date().toISOString();
  }

  static async logActivity(userId, action, details = null, req = null) {
    try {
      const activityData = {
        user_id: userId,
        action,
        details,
        ip_address: req ? req.ip : null,
        user_agent: req && req.headers ? req.headers['user-agent'] : null
      };

      return await this.query().insert(activityData);
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw - activity logging should not break the application flow
      return null;
    }
  }

  static async getUserActivities(userId, limit = 50, offset = 0) {
    return this.query()
      .where('user_id', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .offset(offset);
  }
}

module.exports = ActivityLog;
