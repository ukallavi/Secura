// database/migrations/20230504000000_add_shared_passwords.js
exports.up = function(knex) {
  return knex.schema
    .createTable('shared_passwords', table => {
      table.increments('id').primary();
      table.integer('password_id').notNullable();
      table.integer('owner_id').notNullable();
      table.integer('shared_with_id').notNullable();
      table.enum('permission', ['READ', 'WRITE']).notNullable().defaultTo('READ');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at').nullable();
      table.foreign('password_id').references('passwords.id').onDelete('CASCADE');
      table.foreign('owner_id').references('users.id').onDelete('CASCADE');
      table.foreign('shared_with_id').references('users.id').onDelete('CASCADE');
      table.unique(['password_id', 'shared_with_id']);
    });
};

exports.down = function(knex) {
  return knex.schema.dropTable('shared_passwords');
};