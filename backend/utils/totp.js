const crypto = require('crypto');
const base32 = require('hi-base32');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

// Configure the authenticator
authenticator.options = { 
  digits: 6,
  step: 30,
  window: 1 // Allow 1 step backwards/forwards for time sync issues
};

/**
 * Generate a new TOTP secret
 * @returns {string} The generated secret
 */
const generateSecret = () => {
  const buffer = crypto.randomBytes(20);
  const secret = base32.encode(buffer).replace(/=/g, '');
  return secret;
};

/**
 * Generate a QR code URL for TOTP setup
 * @param {string} email User's email address
 * @param {string} secret TOTP secret
 * @param {string} issuer Name of the application
 * @returns {string} The OTP Auth URL
 */
const generateOtpAuthUrl = (email, secret, issuer = 'Ssecura') => {
  return authenticator.keyuri(email, issuer, secret);
};

/**
 * Generate a QR code as a data URL
 * @param {string} otpAuthUrl The OTP Auth URL
 * @returns {Promise<string>} Promise resolving to a data URL of the QR code
 */
const generateQRCode = async (otpAuthUrl) => {
  try {
    return await QRCode.toDataURL(otpAuthUrl);
  } catch (error) {
    throw new Error('Error generating QR code');
  }
};

/**
 * Verify a TOTP token
 * @param {string} token The token to verify
 * @param {string} secret The TOTP secret
 * @returns {boolean} True if the token is valid
 */
const verifyToken = (token, secret) => {
  try {
    return authenticator.verify({ token, secret });
  } catch (error) {
    return false;
  }
};

module.exports = {
  generateSecret,
  generateOtpAuthUrl,
  generateQRCode,
  verifyToken
};