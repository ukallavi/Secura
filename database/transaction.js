// database/transaction.js
// This file is now obsolete as withTransaction is part of db.js
// For backward compatibility, we'll keep it but refer to the main db.js

const { withTransaction } = require('./db');
const { logger } = require('../backend/utils/logger');

logger.info('database/transaction.js is deprecated, use db.js directly');

module.exports = { withTransaction };