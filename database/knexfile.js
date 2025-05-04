// database/knexfile.js
require('dotenv').config({ path: '../.env' });

const path = require('path');

const defaultSettings = {
  client: 'mysql2',
  migrations: {
    directory: path.resolve(__dirname, './migrations'),
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: path.resolve(__dirname, './seeds')
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
      directory: path.resolve(__dirname, './seeds/development')
    },
    debug: process.env.KNEX_DEBUG === 'true'
  },
  testing: {
    ...defaultSettings,
    connection: {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'secura_test',
      charset: 'utf8mb4'
    },
    seeds: {
      directory: path.resolve(__dirname, './seeds/testing')
    }
  },
  staging: {
    ...defaultSettings,
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4',
      ssl: { rejectUnauthorized: false }
    },
    seeds: {
      directory: './seeds/staging'
    }
  },
  production: {
    ...defaultSettings,
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4',
      ssl: { rejectUnauthorized: false }
    },
    seeds: {
      directory: './seeds/production'
    },
    pool: {
      min: 5,
      max: 30
    }
  }
};
