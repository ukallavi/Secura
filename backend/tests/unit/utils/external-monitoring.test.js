/**
 * Tests for external-monitoring.js
 * Tests the integration with external monitoring services
 */
const { reportToExternalMonitoring, isExternalMonitoringEnabled } = require('../../../utils/external-monitoring');

// Mock external monitoring libraries
jest.mock('@sentry/node', () => {
  return {
    init: jest.fn(),
    captureException: jest.fn(),
    Integrations: {
      Http: jest.fn()
    }
  };
});

jest.mock('dd-trace', () => {
  return {
    init: jest.fn(() => ({
      tracer: {
        captureError: jest.fn()
      }
    }))
  };
});

jest.mock('newrelic', () => ({}));

// Mock environment variables
const originalEnv = process.env;

describe('External Monitoring', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    
    // Clear mocks
    if (require('@sentry/node').captureException) {
      require('@sentry/node').captureException.mockClear();
    }
  });
  
  afterAll(() => {
    process.env = originalEnv;
  });
  
  describe('isExternalMonitoringEnabled', () => {
    test('should return false when no monitoring services are enabled', () => {
      // Ensure no monitoring environment variables are set
      delete process.env.SENTRY_DSN;
      delete process.env.DATADOG_API_KEY;
      delete process.env.NEW_RELIC_LICENSE_KEY;
      
      // Re-require the module to reset initialization
      jest.resetModules();
      const { isExternalMonitoringEnabled } = require('../../../utils/external-monitoring');
      
      expect(isExternalMonitoringEnabled()).toBe(false);
    });
    
    test('should return true when Sentry is enabled', () => {
      process.env.SENTRY_DSN = 'https://exampledsn@sentry.io/123456';
      
      // Re-require the module to reset initialization
      jest.resetModules();
      const { isExternalMonitoringEnabled } = require('../../../utils/external-monitoring');
      
      expect(isExternalMonitoringEnabled()).toBe(true);
    });
    
    test('should return true when DataDog is enabled', () => {
      process.env.DATADOG_API_KEY = 'abcdef123456';
      
      // Re-require the module to reset initialization
      jest.resetModules();
      const { isExternalMonitoringEnabled } = require('../../../utils/external-monitoring');
      
      expect(isExternalMonitoringEnabled()).toBe(true);
    });
    
    test('should return true when New Relic is enabled', () => {
      process.env.NEW_RELIC_LICENSE_KEY = 'abcdef123456';
      
      // Re-require the module to reset initialization
      jest.resetModules();
      const { isExternalMonitoringEnabled } = require('../../../utils/external-monitoring');
      
      expect(isExternalMonitoringEnabled()).toBe(true);
    });
  });
  
  describe('reportToExternalMonitoring', () => {
    test('should not report errors in development by default', async () => {
      process.env.NODE_ENV = 'development';
      process.env.SENTRY_DSN = 'https://exampledsn@sentry.io/123456';
      
      // Re-require the module to reset initialization
      jest.resetModules();
      const { reportToExternalMonitoring } = require('../../../utils/external-monitoring');
      const Sentry = require('@sentry/node');
      
      await reportToExternalMonitoring({
        error_type: 'TEST_ERROR',
        error_message: 'Test error message',
        error_stack: 'Error: Test error message\n    at test (/app/test.js:1:1)',
        context: { test: true },
        user_id: 'anonymized-user-123',
        trace_id: 'trace-123',
        environment: 'development',
        service: 'test-service'
      });
      
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
    
    test('should report errors in development when REPORT_DEV_ERRORS is set', async () => {
      process.env.NODE_ENV = 'development';
      process.env.REPORT_DEV_ERRORS = 'true';
      process.env.SENTRY_DSN = 'https://exampledsn@sentry.io/123456';
      
      // Re-require the module to reset initialization
      jest.resetModules();
      const { reportToExternalMonitoring } = require('../../../utils/external-monitoring');
      const Sentry = require('@sentry/node');
      
      await reportToExternalMonitoring({
        error_type: 'TEST_ERROR',
        error_message: 'Test error message',
        error_stack: 'Error: Test error message\n    at test (/app/test.js:1:1)',
        context: { test: true },
        user_id: 'anonymized-user-123',
        trace_id: 'trace-123',
        environment: 'development',
        service: 'test-service'
      });
      
      expect(Sentry.captureException).toHaveBeenCalled();
    });
    
    test('should report errors in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://exampledsn@sentry.io/123456';
      
      // Re-require the module to reset initialization
      jest.resetModules();
      const { reportToExternalMonitoring } = require('../../../utils/external-monitoring');
      const Sentry = require('@sentry/node');
      
      const errorData = {
        error_type: 'TEST_ERROR',
        error_message: 'Test error message',
        error_stack: 'Error: Test error message\n    at test (/app/test.js:1:1)',
        context: { test: true },
        user_id: 'anonymized-user-123',
        trace_id: 'trace-123',
        environment: 'production',
        service: 'test-service'
      };
      
      await reportToExternalMonitoring(errorData);
      
      expect(Sentry.captureException).toHaveBeenCalled();
      
      // Verify Sentry was called with correct data
      const sentryCallArg = Sentry.captureException.mock.calls[0][0];
      expect(sentryCallArg instanceof Error).toBe(true);
      expect(sentryCallArg.message).toBe(errorData.error_message);
      expect(sentryCallArg.stack).toBe(errorData.error_stack);
      expect(sentryCallArg.name).toBe(errorData.error_type);
      
      const sentryOptions = Sentry.captureException.mock.calls[0][1];
      expect(sentryOptions.tags.error_type).toBe(errorData.error_type);
      expect(sentryOptions.tags.environment).toBe(errorData.environment);
      expect(sentryOptions.tags.service).toBe(errorData.service);
      expect(sentryOptions.extra.trace_id).toBe(errorData.trace_id);
      expect(sentryOptions.user.id).toBe(errorData.user_id);
    });
    
    test('should handle errors during reporting', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://exampledsn@sentry.io/123456';
      
      // Re-require the module to reset initialization
      jest.resetModules();
      const { reportToExternalMonitoring } = require('../../../utils/external-monitoring');
      const Sentry = require('@sentry/node');
      
      // Make Sentry throw an error
      Sentry.captureException.mockImplementationOnce(() => {
        throw new Error('Sentry error');
      });
      
      // This should not throw
      await expect(reportToExternalMonitoring({
        error_type: 'TEST_ERROR',
        error_message: 'Test error message',
        error_stack: 'Error: Test error message\n    at test (/app/test.js:1:1)',
        context: { test: true },
        user_id: 'anonymized-user-123',
        trace_id: 'trace-123',
        environment: 'production',
        service: 'test-service'
      })).resolves.not.toThrow();
    });
  });
});
