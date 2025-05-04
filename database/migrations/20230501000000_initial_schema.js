// database/migrations/20230501000000_initial_schema.js
/**
 * Consolidated initial database schema for Secura password manager
 * This creates all necessary tables and relationships in a single migration
 * All separate migrations have been merged into this file
 */
exports.up = function(knex) {
  return knex.schema
    // Users table - stores application user information
    .createTable('users', table => {
      table.increments('id').primary(); // Primary key
      table.string('email', 255).notNullable().unique(); // User's email address (unique)
      table.string('password', 255).notNullable(); // Hashed password for authentication
      table.string('first_name', 255).nullable(); // User's first name
      table.string('last_name', 255).nullable(); // User's last name
      table.enum('role', ['user', 'admin']).notNullable().defaultTo('user'); // User role for permissions
      table.string('totp_secret', 255).nullable(); // Secret for two-factor authentication
      table.string('two_factor_temp_secret', 128).nullable(); // Temporary secret for 2FA setup
      table.boolean('totp_enabled').notNullable().defaultTo(false); // Whether 2FA is enabled
      table.string('encryption_salt', 64).nullable(); // Salt for client-side encryption of passwords
      table.string('auth_salt', 64).nullable(); // Salt for password authentication
      table.string('recovery_email', 255).nullable(); // Email address for account recovery
      table.timestamp('created_at').defaultTo(knex.fn.now()); // When the user account was created
      table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')); // Last update timestamp

      // Security settings columns
      table.boolean('password_strength_check').notNullable().defaultTo(true);
      table.boolean('login_notifications').notNullable().defaultTo(false);
      table.boolean('inactivity_timeout').notNullable().defaultTo(true);
      table.boolean('password_expiry_check').notNullable().defaultTo(true);
    })
    
    // Passwords table - stores password entries for users
    .createTable('passwords', table => {
      table.increments('id').primary(); // Primary key
      table.integer('user_id').unsigned().notNullable(); // Owner of this password entry
      table.string('title', 255).notNullable(); // Title/name of the password entry (e.g., "Gmail")
      table.string('username', 255).nullable(); // Username for this password entry (e.g., user@gmail.com)
      table.text('password_encrypted').notNullable(); // Encrypted password
      table.string('url', 1024).nullable(); // Website URL associated with this password
      table.text('notes').nullable(); // Additional notes about this password entry
      table.string('category', 100).nullable(); // Category for organization (e.g., "Social", "Work")
      table.boolean('favorite').notNullable().defaultTo(false); // Whether this is a favorite entry
      table.timestamp('created_at').defaultTo(knex.fn.now()); // When this password was created
      table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')); // Last update timestamp
      
      // Add foreign key constraint
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      
      // Add indexes for faster queries
      table.index(['user_id', 'title']);
      table.index(['user_id', 'category']);
    })
    
    // Shared passwords table - tracks password sharing between users
    .createTable('shared_passwords', table => {
      table.increments('id').primary(); // Primary key
      table.integer('password_id').unsigned().notNullable(); // Reference to the shared password
      table.integer('owner_id').unsigned().notNullable(); // User who owns the password
      table.integer('shared_with_id').unsigned().notNullable(); // User who received access
      table.enum('permission', ['READ', 'WRITE']).notNullable().defaultTo('READ'); // Permission level
      table.timestamp('created_at').defaultTo(knex.fn.now()); // When sharing was created
      table.timestamp('expires_at').nullable(); // When sharing expires (if applicable)
      
      // Add foreign key constraints
      table.foreign('password_id').references('passwords.id').onDelete('CASCADE');
      table.foreign('owner_id').references('users.id').onDelete('CASCADE');
      table.foreign('shared_with_id').references('users.id').onDelete('CASCADE');
      
      // Ensure a password can only be shared once with each user
      table.unique(['password_id', 'shared_with_id']);
    })
    
    // Activity logs table - tracks user actions for security and auditing
    .createTable('activity_logs', table => {
      table.increments('id').primary(); // Primary key
      table.integer('user_id').unsigned().notNullable(); // User who performed the action
      table.string('action', 100).notNullable(); // Type of action performed
      table.text('details').nullable(); // Additional details about the action
      table.string('ip_address', 45).nullable(); // IP address of the user
      table.string('user_agent', 255).nullable(); // User's browser/device info
      table.timestamp('created_at').defaultTo(knex.fn.now()); // When the action occurred
      
      // Add foreign key constraint
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      
      // Add index for faster queries
      table.index(['user_id', 'created_at']);
    })
    
    // Account recovery keys - for account recovery without email
    .createTable('account_recovery_keys', table => {
      table.increments('id').primary(); // Primary key
      table.integer('user_id').unsigned().notNullable(); // User who owns this recovery key
      table.string('key_hash', 255).notNullable(); // Hashed recovery key
      table.timestamp('created_at').defaultTo(knex.fn.now()); // When the key was created
      table.foreign('user_id').references('users.id').onDelete('CASCADE'); // Foreign key constraint
    })
    
    // Account recovery tokens - for password reset via email
    .createTable('account_recovery_tokens', table => {
      table.increments('id').primary(); // Primary key
      table.integer('user_id').unsigned().notNullable(); // User who requested recovery
      table.string('token', 255).notNullable(); // Recovery token
      table.boolean('used').defaultTo(false); // Whether token has been used
      table.timestamp('expires_at').notNullable(); // When token expires
      table.timestamp('created_at').defaultTo(knex.fn.now()); // When token was created
      table.foreign('user_id').references('users.id').onDelete('CASCADE'); // Foreign key constraint
    })
    
    // Rate limits - for preventing brute force attacks
    .createTable('rate_limits', table => {
      table.increments('id').primary(); // Primary key
      table.string('key', 255).notNullable(); // Rate limit key (e.g., IP address or user ID)
      table.timestamp('created_at').defaultTo(knex.fn.now()); // When the entry was created
      table.integer('points').unsigned().notNullable().defaultTo(1); // Points used (for token bucket algorithm)
      table.timestamp('expires_at').notNullable(); // When the rate limit expires
      table.index(['key', 'expires_at']); // Index for faster lookups
    })
    
    // Security alerts - for notifying users of security events
    .createTable('security_alerts', table => {
      table.increments('id').primary(); // Primary key
      table.integer('user_id').unsigned().notNullable(); // User who should see this alert
      table.string('type', 100).notNullable(); // Type of security alert
      table.text('message').notNullable(); // Alert message
      table.boolean('read').defaultTo(false); // Whether user has read the alert
      table.boolean('resolved').defaultTo(false); // Whether the alert has been resolved
      table.timestamp('created_at').defaultTo(knex.fn.now()); // When the alert was created
      table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')); // Last update
      table.foreign('user_id').references('users.id').onDelete('CASCADE'); // Foreign key constraint
    })
    
    // Error logs - for tracking application errors
    .createTable('error_logs', table => {
      table.increments('id').primary(); // Primary key
      table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now()); // When the error occurred
      table.string('session_id', 255).notNullable().index(); // Session ID for correlation
      table.string('url', 2048).nullable(); // URL where the error occurred
      table.string('user_agent', 1024).nullable(); // Browser/device info
      table.integer('error_count').unsigned().defaultTo(1); // Number of occurrences
      table.string('error_type', 50).notNullable().index(); // Type of error
      table.string('error_message', 1024).notNullable(); // Error message
      table.integer('error_status').unsigned().nullable(); // HTTP status code if applicable
      table.text('error_stack').nullable(); // Error stack trace
      table.text('context').nullable(); // Additional context
      table.string('user_id', 255).nullable().index(); // User who experienced the error
      table.string('user_role', 50).nullable(); // User's role
      table.string('ip_address', 50).nullable(); // IP address
      table.boolean('is_resolved').defaultTo(false); // Whether the error has been resolved
      table.timestamp('resolved_at').nullable(); // When the error was resolved
      table.string('resolved_by').nullable(); // Who resolved the error
      table.text('resolution_notes').nullable(); // Notes on resolution
      table.text('tags').nullable(); // Tags for categorization
      table.string('environment', 50).defaultTo('production').index(); // Environment (dev/prod)
      table.string('trace_id', 36).nullable().index(); // Trace ID for distributed tracing
      table.string('service', 50).nullable().index(); // Service that generated the error
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()); // When the log was created
      
      // Indexes for faster querying
      table.index('timestamp');
      table.index('is_resolved');
    })
    
    // Audit logs - for security-relevant actions
    .createTable('audit_logs', table => {
      table.increments('id').primary(); // Primary key
      table.string('user_id', 255).nullable().index(); // User who performed the action
      table.string('action', 100).notNullable().index(); // Action performed
      table.string('entity', 100).notNullable().index(); // Entity affected
      table.string('entity_id', 255).nullable().index(); // ID of affected entity
      table.text('details').nullable(); // Additional details
      table.string('ip_address', 50).nullable(); // IP address
      table.string('user_agent', 1024).nullable(); // Browser/device info
      table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now()); // When the action occurred
      table.string('session_id', 255).nullable().index(); // Session ID
      
      // Indexes for faster querying
      table.index('timestamp');
    })
    
    // Add fulltext search capabilities
    .raw(`
      ALTER TABLE passwords 
      ADD FULLTEXT INDEX password_search_idx (title, username, url, notes)
    `)
    
    // Backup codes table - for two-factor authentication recovery
    .createTable('backup_codes', table => {
      table.increments('id').primary(); // Primary key
      table.integer('user_id').unsigned().notNullable(); // User who owns these backup codes
      table.string('code').notNullable(); // Hashed backup code
      table.boolean('used').defaultTo(false); // Whether the code has been used
      table.timestamp('created_at').defaultTo(knex.fn.now()); // When the code was created
      table.timestamp('updated_at').nullable(); // When the code was last updated
      
      // Add foreign key constraint
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      
      // Add index for faster queries
      table.index(['user_id', 'used']);
    })
    
    // Recovery tokens table - for email-based account recovery
    .createTable('recovery_tokens', table => {
      table.increments('id').primary(); // Primary key
      table.integer('user_id').unsigned().notNullable(); // User who requested recovery
      table.string('token').notNullable(); // Hashed recovery token
      table.timestamp('expires_at').notNullable(); // When the token expires
      table.timestamp('created_at').defaultTo(knex.fn.now()); // When the token was created
      
      // Add foreign key constraint
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      
      // Add index for faster queries
      table.index('user_id');
    });
};

exports.down = function(knex) {
  return knex.schema
    // Drop tables in reverse order of creation (respecting foreign key constraints)
    .dropTableIfExists('recovery_tokens')
    .dropTableIfExists('backup_codes')
    .dropTableIfExists('audit_logs')
    .dropTableIfExists('error_logs')
    .dropTableIfExists('security_alerts')
    .dropTableIfExists('rate_limits')
    .dropTableIfExists('account_recovery_tokens')
    .dropTableIfExists('account_recovery_keys')
    .dropTableIfExists('activity_logs')
    .dropTableIfExists('shared_passwords')
    .dropTableIfExists('passwords')
    .dropTableIfExists('users');
};