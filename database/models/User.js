// database/models/User.js
const BaseModel = require('./BaseModel');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

class User extends BaseModel {
  static get tableName() {
    return 'users';
  }

  static get idColumn() {
    return 'id';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['email', 'password_hash'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        username: { type: 'string', minLength: 3 },
        password_hash: { type: 'string' },
        first_name: { type: ['string', 'null'] },
        last_name: { type: ['string', 'null'] },
        role: { type: 'string', enum: ['user', 'admin'] },
        two_factor_secret: { type: ['string', 'null'] },
        two_factor_enabled: { type: 'boolean', default: false },
        last_login: { type: ['string', 'null'], format: 'date-time' },
        password_reset_token: { type: ['string', 'null'] },
        password_reset_expires: { type: ['string', 'null'], format: 'date-time' },
        account_locked: { type: 'boolean', default: false },
        failed_login_attempts: { type: 'integer', default: 0 },
        lockout_until: { type: ['string', 'null'], format: 'date-time' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    };
  }

  $beforeInsert() {
    super.$beforeInsert();
    this.id = this.id || uuidv4();
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
    this.role = this.role || 'user';
  }

  $beforeUpdate() {
    super.$beforeUpdate();
    this.updated_at = new Date().toISOString();
  }

  static async findByEmail(email) {
    return this.query().where('email', email).first();
  }

  static async findById(id) {
    return this.query().findById(id);
  }

  static async createUser(userData) {
    // Hash password if provided
    if (userData.password) {
      userData.password_hash = await bcrypt.hash(userData.password, 10);
      delete userData.password;
    }

    return this.query().insert(userData);
  }

  async verifyPassword(password) {
    return bcrypt.compare(password, this.password_hash);
  }

  toJSON() {
    const json = super.toJSON();
    delete json.password_hash;
    delete json.password_reset_token;
    delete json.two_factor_secret;
    return json;
  }
}

module.exports = User;
