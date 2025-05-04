/**
 * Error notification system for critical errors
 * Sends notifications to administrators through various channels
 */

const nodemailer = require('nodemailer');
const db = require('../../database/db');
const { logger } = require('./logger');

// Email configuration
const emailTransporter = process.env.NODE_ENV === 'production' 
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    })
  : {
      // Development mode - log instead of sending
      sendMail: (mailOptions) => {
        logger.info('Would send email in production:', mailOptions);
        return Promise.resolve({ messageId: 'dev-mode-' + Date.now() });
      }
    };

/**
 * Check if an error is critical and requires immediate attention
 * @param {Object} error - Error object
 * @returns {boolean} True if error is critical
 */
function isCriticalError(error) {
  if (!error) return false;
  
  // Server errors are always critical
  if (error.error_type === 'SERVER_ERROR') return true;
  
  // HTTP 5xx errors are critical
  if (error.error_status && error.error_status >= 500) return true;
  
  // Security-related errors are critical
  if (error.error_message && (
    error.error_message.toLowerCase().includes('security') ||
    error.error_message.toLowerCase().includes('authentication') ||
    error.error_message.toLowerCase().includes('authorization') ||
    error.error_message.toLowerCase().includes('breach') ||
    error.error_message.toLowerCase().includes('hack') ||
    error.error_message.toLowerCase().includes('exploit')
  )) return true;
  
  // Database errors are critical
  if (error.error_type === 'DATABASE_ERROR') return true;
  
  // High error count in short time is critical (detected elsewhere)
  
  return false;
}

/**
 * Send email notification for critical error
 * @param {Object} error - Error object
 * @returns {Promise<boolean>} Success status
 */
async function sendEmailNotification(error) {
  try {
    // Get admin email addresses from database or config
    const adminEmails = process.env.ADMIN_EMAILS 
      ? process.env.ADMIN_EMAILS.split(',') 
      : ['admin@secura.com'];
    
    // Prepare email content
    const mailOptions = {
      from: `"Secura Error Monitor" <${process.env.SMTP_FROM || 'errors@secura.com'}>`,
      to: adminEmails.join(','),
      subject: `[CRITICAL] Secura Error: ${error.error_type}`,
      text: `
A critical error has occurred in the Secura application.

Error ID: ${error.id}
Type: ${error.error_type}
Message: ${error.error_message}
Status: ${error.error_status || 'N/A'}
URL: ${error.url || 'N/A'}
Timestamp: ${new Date(error.timestamp).toISOString()}

You can view the full details at:
${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/error-monitoring/${error.id}

This is an automated message. Please do not reply.
`,
      html: `
<h2>Critical Error in Secura</h2>
<p>A critical error has occurred in the Secura application.</p>

<table border="0" cellpadding="5" style="border-collapse: collapse;">
  <tr>
    <td><strong>Error ID:</strong></td>
    <td>${error.id}</td>
  </tr>
  <tr>
    <td><strong>Type:</strong></td>
    <td>${error.error_type}</td>
  </tr>
  <tr>
    <td><strong>Message:</strong></td>
    <td>${error.error_message}</td>
  </tr>
  <tr>
    <td><strong>Status:</strong></td>
    <td>${error.error_status || 'N/A'}</td>
  </tr>
  <tr>
    <td><strong>URL:</strong></td>
    <td>${error.url || 'N/A'}</td>
  </tr>
  <tr>
    <td><strong>Timestamp:</strong></td>
    <td>${new Date(error.timestamp).toISOString()}</td>
  </tr>
</table>

<p>
  <a href="${process.env.ADMIN_URL || 'http://localhost:3000'}/admin/error-monitoring/${error.id}" 
     style="background-color: #4CAF50; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 15px;">
    View Error Details
  </a>
</p>

<p style="color: #777; font-size: 12px; margin-top: 20px;">
  This is an automated message. Please do not reply.
</p>
`
    };
    
    // Send email
    const info = await emailTransporter.sendMail(mailOptions);
    logger.info(`Email notification sent for error ${error.id}:`, info.messageId);
    return true;
  } catch (err) {
    logger.error('Failed to send email notification:', err);
    return false;
  }
}

/**
 * Store notification in admin notification center
 * @param {Object} error - Error object
 * @returns {Promise<boolean>} Success status
 */
async function storeAdminNotification(error) {
  try {
    await db('admin_notifications').insert({
      type: 'ERROR',
      title: `Critical Error: ${error.error_type}`,
      message: error.error_message,
      link: `/admin/error-monitoring/${error.id}`,
      is_read: false,
      created_at: db.fn.now()
    });
    
    logger.info(`Admin notification stored for error ${error.id}`);
    return true;
  } catch (err) {
    logger.error('Failed to store admin notification:', err);
    return false;
  }
}

/**
 * Send notifications for critical error
 * @param {Object} error - Error object
 * @returns {Promise<Object>} Notification results
 */
async function notifyCriticalError(error) {
  if (!isCriticalError(error)) {
    return { notified: false, reason: 'Not a critical error' };
  }
  
  const results = {
    notified: false,
    email: false,
    notification: false
  };
  
  // Send email notification
  results.email = await sendEmailNotification(error);
  
  // Store in admin notification center
  results.notification = await storeAdminNotification(error);
  
  // Set notified flag if any notification method succeeded
  results.notified = results.email || results.notification;
  
  return results;
}

/**
 * Check for error spikes (sudden increase in error rate)
 * @returns {Promise<void>}
 */
async function checkForErrorSpikes() {
  try {
    // Get error count in the last hour
    const hourlyResult = await db('error_logs')
      .where('created_at', '>', db.raw('NOW() - INTERVAL 1 HOUR'))
      .count('* as count')
      .first();
    
    const hourlyCount = parseInt(hourlyResult.count);
    
    // Get average hourly error count over the last 24 hours
    const dailyResult = await db('error_logs')
      .where('created_at', '>', db.raw('NOW() - INTERVAL 24 HOUR'))
      .where('created_at', '<', db.raw('NOW() - INTERVAL 1 HOUR')) // Exclude the last hour
      .count('* as count')
      .first();
    
    const dailyCount = parseInt(dailyResult.count);
    const avgHourlyCount = dailyCount / 23; // 24 hours minus the current hour
    
    // Check if current hour has significantly more errors than average
    const threshold = Math.max(10, avgHourlyCount * 2); // At least 10 errors or double the average
    
    if (hourlyCount > threshold) {
      // Error spike detected
      logger.warn(`Error spike detected: ${hourlyCount} errors in the last hour (threshold: ${threshold})`);
      
      // Create a synthetic error for notification
      const spikeError = {
        id: `spike-${Date.now()}`,
        error_type: 'ERROR_SPIKE',
        error_message: `Unusual error activity: ${hourlyCount} errors in the last hour (${Math.round(hourlyCount / avgHourlyCount * 100) / 100}x normal rate)`,
        timestamp: new Date(),
        url: null
      };
      
      // Notify administrators
      await notifyCriticalError(spikeError);
    }
  } catch (err) {
    logger.error('Error checking for error spikes:', err);
  }
}

module.exports = {
  isCriticalError,
  notifyCriticalError,
  checkForErrorSpikes
};
