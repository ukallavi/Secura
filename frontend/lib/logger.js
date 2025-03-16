// frontend/lib/logger.js

// Environment-aware logger that doesn't log in production
const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args) => {
    if (isDevelopment) {
      console.error(...args);
    }
    
    // In a real app, you might want to send errors to a monitoring service
    // even in production, but without sensitive information
    if (!isDevelopment && args[0] && typeof args[0] === 'string') {
      // Send to monitoring service like Sentry
      // Example: Sentry.captureException(new Error(args[0]));
    }
  },
  
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  }
};

export default logger;