// database/migrations/20230503000000_add_rate_limiting.js
exports.up = function(knex) {
  return knex.schema
    .createTable('rate_limits', table => {
      table.increments('id').primary();
      table.string('key', 255).notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.integer('points').unsigned().notNullable().defaultTo(1);
      table.timestamp('expires_at').notNullable();
      table.index(['key', 'expires_at']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTable('rate_limits');
};