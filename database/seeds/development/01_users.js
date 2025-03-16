// database/seeds/development/01_users.js
const bcrypt = require('bcrypt');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('users').del();
  
  // Create admin user
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  
  // Create test user
  const userPassword = await bcrypt.hash('Test123!', 10);
  
  await knex('users').insert([
    {
      id: 1,
      email: 'admin@example.com',
      password: adminPassword,
      role: 'admin',
      totp_enabled: false
    },
    {
      id: 2,
      email: 'user@example.com',
      password: userPassword,
      role: 'user',
      totp_enabled: false
    }
  ]);
};