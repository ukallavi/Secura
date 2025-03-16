// database/migrations/20230506000000_add_fulltext_search.js
exports.up = function(knex) {
  return knex.schema.table('passwords', table => {
    // Add full-text index
    knex.raw(`
      ALTER TABLE passwords 
      ADD FULLTEXT INDEX password_search_idx (account_name, username, url, notes)
    `);
  });
};

exports.down = function(knex) {
  return knex.schema.table('passwords', table => {
    // Drop full-text index
    knex.raw(`
      ALTER TABLE passwords 
      DROP INDEX password_search_idx
    `);
  });
};