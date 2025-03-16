// database/migrations/20230502000000_add_recovery_keys.js
exports.up = function(knex) {
  return knex.schema
    .createTable('account_recovery_keys', table => {
      table.increments('id').primary();
      table.integer('user_id').notNullable();
      table.string('key_hash', 255).notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
    })
    .createTable('account_recovery_tokens', table => {
      table.increments('id').primary();
      table.integer('user_id').notNullable();
      table.string('token', 255).notNullable();
      table.boolean('used').defaultTo(false);
      table.timestamp('expires_at').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('account_recovery_tokens')
    .dropTable('account_recovery_keys');
};