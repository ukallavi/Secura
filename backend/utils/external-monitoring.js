/**
 * External Monitoring Integration
 * Provides integration with external monitoring tools like Sentry, DataDog, etc.
 */
const { logger } = require('./logger');

// Initialize monitoring clients based on environment variables
let sentryInitialized = false;
let datadogInitialized = false;
let newRelicInitialized = false;

// Sentry integration
let Sentry;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    const Tracing = require('@sentry/tracing');
    
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || '1.0.0',
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Tracing.Integrations.Express({ app }),
      ],
      tracesSampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '0.1'),
      // Don't send PII by default
      sendDefaultPii: false,
      beforeSend(event) {
        // Sanitize event data if needed
        if (event.user) {
          // Remove sensitive user data
          delete event.user.email;
          delete event.user.ip_address;
        }
        return event;
      }
    });
    
    sentryInitialized = true;
    logger.info('Sentry monitoring initialized');
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error);
  }
}

// DataDog integration
let datadog;
if (process.env.DATADOG_API_KEY) {
  try {
    datadog = require('dd-trace').init({
      env: process.env.NODE_ENV || 'development',
      service: 'secura-backend',
      version: process.env.APP_VERSION || '1.0.0',
      logInjection: true
    });
    
    datadogInitialized = true;
    logger.info('DataDog monitoring initialized');
  } catch (error) {
    logger.error('Failed to initialize DataDog:', error);
  }
}

// New Relic integration
if (process.env.NEW_RELIC_LICENSE_KEY) {
  try {
    require('newrelic');
    newRelicInitialized = true;
    logger.info('New Relic monitoring initialized');
  } catch (error) {
    logger.error('Failed to initialize New Relic:', error);
  }
}

/**
 * Report an error to external monitoring services
 * @param {Object} errorData - Error data to report
 * @param {string} errorData.error_type - Type of error
 * @param {string} errorData.error_message - Error message
 * @param {string} errorData.error_stack - Error stack trace
 * @param {Object} errorData.context - Additional context
 * @param {string} errorData.user_id - Anonymized user ID
 * @param {string} errorData.trace_id - Trace ID for correlation
 * @param {string} errorData.environment - Environment where error occurred
 * @param {string} errorData.service - Service that generated the error
 */
const reportToExternalMonitoring = async (errorData) => {
  // Skip if error is not critical or in development
  if (process.env.NODE_ENV === 'development' && !process.env.REPORT_DEV_ERRORS) {
    return;
  }
  
  try {
    // Report to Sentry
    if (sentryInitialized) {
      const sentryError = new Error(errorData.error_message);
      sentryError.stack = errorData.error_stack;
      sentryError.name = errorData.error_type;
      
      Sentry.captureException(sentryError, {
        tags: {
          error_type: errorData.error_type,
          environment: errorData.environment,
          service: errorData.service
        },
        extra: {
          context: errorData.context,
          trace_id: errorData.trace_id
        },
        user: {
          id: errorData.user_id // Already anonymized
        }
      });
      
      logger.debug('Error reported to Sentry');
    }
    
    // Report to DataDog
    if (datadogInitialized) {
      datadog.tracer.captureError(new Error(errorData.error_message), {
        tags: {
          'error.type': errorData.error_type,
          'error.environment': errorData.environment,
          'error.service': errorData.service,
          'error.trace_id': errorData.trace_id
        }
      });
      
      logger.debug('Error reported to DataDog');
    }
    
    // New Relic is automatically capturing errors if initialized
    
  } catch (error) {
    logger.error('Failed to report to external monitoring:', error);
  }
};

/**
 * Check if any external monitoring service is enabled
 * @returns {boolean} True if at least one service is enabled
 */
const isExternalMonitoringEnabled = () => {
  return sentryInitialized || datadogInitialized || newRelicInitialized;
};

module.exports = {
  reportToExternalMonitoring,
  isExternalMonitoringEnabled,
  // Export initialized services for direct access if needed
  Sentry: sentryInitialized ? Sentry : null,
  datadog: datadogInitialized ? datadog : null
};
