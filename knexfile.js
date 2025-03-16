// knexfile.js
require('dotenv').config();

const defaultSettings = {
  client: 'mysql2',
  migrations: {
    directory: './database/migrations',
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: './database/seeds'
  },
  pool: {
    min: 2,
    max: 10
  }
};

module.exports = {
  development: {
    ...defaultSettings,
    connection: {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'secura_dev',
      charset: 'utf8mb4'
    },
    seeds: {
      directory: './database/seeds/development'
    },
    debug: process.env.KNEX_DEBUG === 'true'
  },

  test: {
    ...defaultSettings,
    connection: {
      host: process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost',
      user: process.env.TEST_DB_USER || process.env.DB_USER || 'root',
      password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || '',
      database: process.env.TEST_DB_NAME || 'secura_test',
      charset: 'utf8mb4'
    },
    seeds: {
      directory: './database/seeds/test'
    },
    // Disable connection pool for tests
    pool: {
      min: 1,
      max: 1
    }
  },

  staging: {
    ...defaultSettings,
    connection: {
      host: process.env.STAGING_DB_HOST,
      user: process.env.STAGING_DB_USER,
      password: process.env.STAGING_DB_PASSWORD,
      database: process.env.STAGING_DB_NAME,
      charset: 'utf8mb4',
      ssl: {
        rejectUnauthorized: false
      }
    },
    pool: {
      min: 2,
      max: 10
    }
  },

  production: {
    ...defaultSettings,
    connection: {
      host: process.env.PROD_DB_HOST,
      user: process.env.PROD_DB_USER,
      password: process.env.PROD_DB_PASSWORD,
      database: process.env.PROD_DB_NAME,
      charset: 'utf8mb4',
      ssl: process.env.DB_SSL === 'true' ? 
        { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : 
        undefined
    },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 30000
    },
    seeds: {
      directory: './database/seeds/production'
    },
    // Recommended production settings
    acquireConnectionTimeout: 10000,
    debug: false
  }
};