// database/migrations/20230501000000_initial_schema.js
exports.up = function(knex) {
  return knex.schema
    .createTable('users', table => {
      table.increments('id').primary();
      table.string('email', 255).notNullable().unique();
      table.string('password', 255).notNullable();
      table.enum('role', ['user', 'admin']).notNullable().defaultTo('user');
      table.string('totp_secret', 255).nullable();
      table.boolean('totp_enabled').notNullable().defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    })
    .createTable('passwords', table => {
      table.increments('id').primary();
      table.integer('user_id').notNullable();
      table.string('account_name', 255).notNullable();
      table.string('username', 255).nullable();
      table.text('password_encrypted').notNullable();
      table.string('url', 1024).nullable();
      table.text('notes').nullable();
      table.string('category', 100).nullable();
      table.boolean('favorite').notNullable().defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      
      // Add foreign key constraint
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      
      // Add indexes
      table.index(['user_id', 'account_name']);
      table.index(['user_id', 'category']);
    })
    .createTable('activity_logs', table => {
      table.increments('id').primary();
      table.integer('user_id').notNullable();
      table.string('action', 100).notNullable();
      table.text('details').nullable();
      table.string('ip_address', 45).nullable();
      table.string('user_agent', 255).nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Add foreign key constraint
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      
      // Add index for faster queries
      table.index(['user_id', 'created_at']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('activity_logs')
    .dropTable('passwords')
    .dropTable('users');
};