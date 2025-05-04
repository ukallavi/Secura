// frontend/lib/i18n/error-messages.js
/**
 * Internationalized error messages for Secura
 * 
 * This module provides translated error messages for different languages.
 * It uses a simple key-based approach that can be extended to use more
 * sophisticated i18n libraries like react-intl or next-intl.
 */

// Default language
let currentLanguage = 'en';

// Available languages
export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'ja', 'ar'];

// Error message translations
const errorMessages = {
  // English messages
  en: {
    // Authentication errors
    'auth.invalid_credentials': 'Invalid email or password',
    'auth.account_locked': 'Your account has been temporarily locked due to multiple failed login attempts',
    'auth.session_expired': 'Your session has expired. Please log in again',
    'auth.verification_required': 'Additional verification is required for your security',
    'auth.password_mismatch': 'Passwords do not match',
    'auth.weak_password': 'Password is too weak',
    'auth.email_in_use': 'This email is already registered',
    'auth.invalid_token': 'Invalid or expired verification token',
    'auth.account_disabled': 'This account has been disabled',
    
    // Password management errors
    'password.not_found': 'The requested password was not found',
    'password.access_denied': 'You do not have permission to access this password',
    'password.already_exists': 'A password with this title already exists',
    'password.invalid_format': 'Password data is in an invalid format',
    'password.encryption_failed': 'Failed to encrypt password data',
    'password.decryption_failed': 'Failed to decrypt password data',
    'password.sharing_failed': 'Failed to share password',
    'password.user_not_found': 'User not found for sharing',
    
    // Security errors
    'security.suspicious_activity': 'Suspicious activity detected on your account',
    'security.location_change': 'Login from a new location detected',
    'security.device_change': 'Login from a new device detected',
    'security.rate_limit': 'Too many attempts. Please try again later',
    'security.2fa_required': 'Two-factor authentication is required',
    'security.2fa_failed': 'Two-factor authentication failed',
    'security.2fa_setup_failed': 'Failed to set up two-factor authentication',
    
    // Network errors
    'network.offline': 'You appear to be offline. Please check your connection',
    'network.timeout': 'Request timed out. Please try again',
    'network.server_error': 'Server error. Our team has been notified',
    
    // General errors
    'general.unknown_error': 'An unknown error occurred',
    'general.form_validation': 'Please correct the errors in the form',
    'general.required_field': 'This field is required',
    'general.invalid_format': 'Invalid format',
    'general.try_again': 'Please try again',
    
    // Help texts
    'help.password_requirements': 'Password must be at least 10 characters with uppercase, lowercase, number, and special character',
    'help.contact_support': 'If this problem persists, please contact support',
    'help.refresh_page': 'Try refreshing the page',
    'help.clear_cache': 'Try clearing your browser cache',
    'help.check_caps_lock': 'Check if Caps Lock is on',
  },
  
  // Spanish messages (example)
  es: {
    'auth.invalid_credentials': 'Correo electrónico o contraseña inválidos',
    'auth.account_locked': 'Su cuenta ha sido bloqueada temporalmente debido a múltiples intentos fallidos de inicio de sesión',
    'auth.session_expired': 'Su sesión ha expirado. Por favor inicie sesión nuevamente',
    // Add more Spanish translations as needed
  },
  
  // French messages (example)
  fr: {
    'auth.invalid_credentials': 'Email ou mot de passe invalide',
    'auth.account_locked': 'Votre compte a été temporairement verrouillé en raison de plusieurs tentatives de connexion infructueuses',
    'auth.session_expired': 'Votre session a expiré. Veuillez vous reconnecter',
    // Add more French translations as needed
  },
  
  // Add more languages as needed
};

/**
 * Set the current language for error messages
 * @param {string} language - Language code (e.g., 'en', 'es')
 */
export function setLanguage(language) {
  if (SUPPORTED_LANGUAGES.includes(language)) {
    currentLanguage = language;
  } else {
    console.warn(`Language '${language}' not supported, falling back to English`);
    currentLanguage = 'en';
  }
}

/**
 * Get a translated error message
 * @param {string} key - Message key
 * @param {Object} params - Parameters to interpolate in the message
 * @returns {string} Translated message
 */
export function getErrorMessage(key, params = {}) {
  // Get the message from the current language, fall back to English
  const messages = errorMessages[currentLanguage] || errorMessages.en;
  let message = messages[key] || errorMessages.en[key] || key;
  
  // Interpolate parameters
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([param, value]) => {
      message = message.replace(`{${param}}`, value);
    });
  }
  
  return message;
}

/**
 * Get help text for an error
 * @param {string} errorKey - Error message key
 * @returns {string|null} Help text or null if not found
 */
export function getErrorHelpText(errorKey) {
  // Map error keys to help text keys
  const helpMap = {
    'auth.invalid_credentials': 'help.check_caps_lock',
    'auth.account_locked': 'help.contact_support',
    'auth.weak_password': 'help.password_requirements',
    'network.offline': 'help.check_connection',
    'network.server_error': 'help.try_again',
    // Add more mappings as needed
  };
  
  const helpKey = helpMap[errorKey];
  return helpKey ? getErrorMessage(helpKey) : null;
}
