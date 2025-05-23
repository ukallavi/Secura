/**
 * Activity action constants for consistent logging across the application
 * These constants are used by the logActivity function to ensure consistent
 * activity tracking for the admin dashboard
 */

// Authentication related actions
const AUTH_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  FAILED_LOGIN: 'FAILED_LOGIN',
  REGISTER: 'REGISTER',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE: 'PASSWORD_RESET_COMPLETE',
  TWO_FACTOR_SETUP: 'TWO_FACTOR_SETUP',
  TWO_FACTOR_VERIFY: 'TWO_FACTOR_VERIFY',
  TWO_FACTOR_DISABLE: 'TWO_FACTOR_DISABLE'
};

// Password management actions
const PASSWORD_ACTIONS = {
  PASSWORD_CREATE: 'PASSWORD_CREATE',
  PASSWORD_UPDATE: 'PASSWORD_UPDATE',
  PASSWORD_DELETE: 'PASSWORD_DELETE',
  PASSWORD_VIEW: 'PASSWORD_VIEW',
  PASSWORD_SHARE: 'PASSWORD_SHARE',
  PASSWORD_UNSHARE: 'PASSWORD_UNSHARE',
  PASSWORD_FAVORITE: 'PASSWORD_FAVORITE',
  PASSWORD_UNFAVORITE: 'PASSWORD_UNFAVORITE',
  PASSWORD_EXPORT: 'PASSWORD_EXPORT',
  PASSWORD_IMPORT: 'PASSWORD_IMPORT'
};

// User profile actions
const USER_ACTIONS = {
  PROFILE_UPDATE: 'PROFILE_UPDATE',
  EMAIL_UPDATE: 'EMAIL_UPDATE',
  ACCOUNT_DELETE: 'ACCOUNT_DELETE',
  SETTINGS_UPDATE: 'SETTINGS_UPDATE'
};

// Admin actions
const ADMIN_ACTIONS = {
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  SYSTEM_SETTINGS_UPDATE: 'SYSTEM_SETTINGS_UPDATE',
  VIEW_ACTIVITY_LOGS: 'VIEW_ACTIVITY_LOGS',
  VIEW_SYSTEM_STATS: 'VIEW_SYSTEM_STATS'
};

// Security related actions
const SECURITY_ACTIONS = {
  SUSPICIOUS_ACTIVITY_DETECTED: 'SUSPICIOUS_ACTIVITY_DETECTED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED: 'ACCOUNT_UNLOCKED',
  IP_BLOCKED: 'IP_BLOCKED',
  BRUTE_FORCE_ATTEMPT: 'BRUTE_FORCE_ATTEMPT'
};

// Export all action types
module.exports = {
  AUTH_ACTIONS,
  PASSWORD_ACTIONS,
  USER_ACTIONS,
  ADMIN_ACTIONS,
  SECURITY_ACTIONS
};
