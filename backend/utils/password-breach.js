const crypto = require('crypto');
const fetch = require('node-fetch');
const { logger, logSecurityEvent } = require('logger');

async function checkPasswordBreach(password) {
  // Hash the password with SHA-1
  const sha1Password = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  
  // Get the first 5 characters of the hash
  const prefix = sha1Password.substring(0, 5);
  const suffix = sha1Password.substring(5);
  
  try {
    // Query the Have I Been Pwned API
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    const data = await response.text();
    
    // Check if the suffix exists in the response
    const breachData = data.split('\r\n').map(line => line.split(':'));
    const breach = breachData.find(([hash]) => hash === suffix);
    
    if (breach) {
      return {
        breached: true,
        count: parseInt(breach[1], 10)
      };
    }
    
    return { breached: false, count: 0 };
  } catch (error) {
    logger.error('Error checking password breach:', error);
    return { breached: false, error: true };
  }
}

module.exports = { checkPasswordBreach };