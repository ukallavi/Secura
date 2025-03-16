const winston = require('winston');
const path = require('path');

// Function to mask sensitive data
const maskSensitiveData = (info) => {
  if (typeof info.message === 'string') {
    // Mask passwords
    info.message = info.message.replace(/("password"\s*:\s*")[^"]+(")/g, '$1[REDACTED]$2');
    info.message = info.message.replace(/("current[Pp]assword"\s*:\s*")[^"]+(")/g, '$1[REDACTED]$2');
    info.message = info.message.replace(/("new[Pp]assword"\s*:\s*")[^"]+(")/g, '$1[REDACTED]$2');
    
    // Mask tokens
    info.message = info.message.replace(/(token=)[^&\s]+/g, '$1[REDACTED]');
    info.message = info.message.replace(/("token"\s*:\s*")[^"]+(")/g, '$1[REDACTED]$2');
    info.message = info.message.replace(/("accessToken"\s*:\s*")[^"]+(")/g, '$1[REDACTED]$2');
    info.message = info.message.replace(/("refreshToken"\s*:\s*")[^"]+(")/g, '$1[REDACTED]$2');
    
    // Mask other sensitive data
    info.message = info.message.replace(/("apiKey"\s*:\s*")[^"]+(")/g, '$1[REDACTED]$2');
    info.message = info.message.replace(/("secret"\s*:\s*")[^"]+(")/g, '$1[REDACTED]$2');
    info.message = info.message.replace(/("authorization"\s*:\s*"Bearer\s+)[^"]+(")/gi, '$1[REDACTED]$2');
    
    // Mask credit card numbers - matches common formats
    info.message = info.message.replace(/\b(?:\d{4}[ -]?){3}\d{4}\b/g, '[REDACTED_CARD]');
    
    // Mask SSNs
    info.message = info.message.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
    
    // Mask encryption keys and IVs
    info.message = info.message.replace(/("iv"\s*:\s*")[^"]+(")/g, '$1[REDACTED]$2');
    info.message = info.message.replace(/("key"\s*:\s*")[^"]+(")/g, '$1[REDACTED]$2');
    info.message = info.message.replace(/("salt"\s*:\s*")[^"]+(")/g, '$1[REDACTED]$2');
    info.message = info.message.replace(/("authTag"\s*:\s*")[^"]+(")/g, '$1[REDACTED]$2');
  }
  
  return info;
};

// Create custom format with masking
const maskFormat = winston.format(maskSensitiveData);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    maskFormat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'secura' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/combined.log') 
    }),
  ],
});

// Add console transport in non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

// Security event logger
const logSecurityEvent = async (userId, action, details, req = null) => {
  const logData = {
    userId,
    action,
    details: maskSensitiveData({ message: details }).message,
    ip: req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null,
    userAgent: req ? req.headers['user-agent'] : null
  };
  
  logger.info(`SECURITY_EVENT: ${action}`, logData);
  
  // Here you could also save to database if needed
};

module.exports = {
  logger,
  logSecurityEvent
};