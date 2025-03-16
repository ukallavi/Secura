// database/migrations/20230505000000_add_security_alerts.js
exports.up = function(knex) {
  return knex.schema
    .createTable('security_alerts', table => {
      table.increments('id').primary();
      table.integer('user_id').notNullable();
      table.string('type', 100).notNullable();
      table.text('message').notNullable();
      table.boolean('read').defaultTo(false);
      table.boolean('resolved').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
    });
};

exports.down = function(knex) {
  return knex.schema.dropTable('security_alerts');
};