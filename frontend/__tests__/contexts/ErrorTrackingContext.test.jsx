/**
 * Tests for ErrorTrackingContext
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorTrackingProvider, useErrorTracking } from '../../contexts/ErrorTrackingContext';

// Mock the API client
jest.mock('../../lib/api-client', () => ({
  reportError: jest.fn(() => Promise.resolve({ success: true, id: 'mock-error-id' }))
}));

// Mock the CSRF token
jest.mock('../../lib/csrf', () => ({
  getCSRFToken: jest.fn(() => 'mock-csrf-token')
}));

// Test component that uses the error tracking context
const TestComponent = ({ onError }) => {
  const { reportError, isEnabled, errorCount } = useErrorTracking();
  
  const handleClick = () => {
    try {
      throw new Error('Test error');
    } catch (error) {
      reportError({
        error_type: 'TEST_ERROR',
        error_message: error.message,
        error_stack: error.stack,
        url: window.location.href,
        context: { test: true }
      });
      
      if (onError) {
        onError({ errorCount });
      }
    }
  };
  
  return (
    <div>
      <div data-testid="enabled">{isEnabled.toString()}</div>
      <div data-testid="error-count">{errorCount}</div>
      <button data-testid="trigger-error" onClick={handleClick}>
        Trigger Error
      </button>
    </div>
  );
};

describe('ErrorTrackingContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    window.ENV = {
      NEXT_PUBLIC_ERROR_TRACKING_ENABLED: 'true',
      NEXT_PUBLIC_ERROR_TRACKING_ENDPOINT: '/api/v1/error-tracking',
      NEXT_PUBLIC_ERROR_TRACKING_SAMPLING_RATE: '1.0',
      NEXT_PUBLIC_ERROR_TRACKING_MAX_ERRORS: '50'
    };
    
    // Mock sessionStorage
    const mockSessionStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true
    });
    
    // Mock localStorage
    const mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
  });
  
  test('should provide error tracking context with default values', () => {
    const { getByTestId } = render(
      <ErrorTrackingProvider>
        <TestComponent />
      </ErrorTrackingProvider>
    );
    
    expect(getByTestId('enabled')).toHaveTextContent('true');
    expect(getByTestId('error-count')).toHaveTextContent('0');
  });
  
  test('should report errors and increment error count', async () => {
    const apiClient = require('../../lib/api-client');
    const mockOnError = jest.fn();
    
    const { getByTestId } = render(
      <ErrorTrackingProvider>
        <TestComponent onError={mockOnError} />
      </ErrorTrackingProvider>
    );
    
    // Trigger an error
    await act(async () => {
      getByTestId('trigger-error').click();
    });
    
    // Check that the API was called with the error
    expect(apiClient.reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: 'TEST_ERROR',
        error_message: 'Test error',
        csrf_token: 'mock-csrf-token'
      })
    );
    
    // Check that the error count was incremented
    expect(getByTestId('error-count')).toHaveTextContent('1');
    expect(mockOnError).toHaveBeenCalledWith(expect.objectContaining({ errorCount: 0 }));
    
    // Trigger another error
    await act(async () => {
      getByTestId('trigger-error').click();
    });
    
    // Check that the error count was incremented again
    expect(getByTestId('error-count')).toHaveTextContent('2');
    expect(mockOnError).toHaveBeenCalledWith(expect.objectContaining({ errorCount: 1 }));
  });
  
  test('should not report errors when tracking is disabled', async () => {
    const apiClient = require('../../lib/api-client');
    
    // Disable error tracking
    window.ENV.NEXT_PUBLIC_ERROR_TRACKING_ENABLED = 'false';
    
    const { getByTestId } = render(
      <ErrorTrackingProvider>
        <TestComponent />
      </ErrorTrackingProvider>
    );
    
    // Check that tracking is disabled
    expect(getByTestId('enabled')).toHaveTextContent('false');
    
    // Trigger an error
    await act(async () => {
      getByTestId('trigger-error').click();
    });
    
    // Check that the API was not called
    expect(apiClient.reportError).not.toHaveBeenCalled();
    
    // Check that the error count was not incremented
    expect(getByTestId('error-count')).toHaveTextContent('0');
  });
  
  test('should respect max errors limit', async () => {
    const apiClient = require('../../lib/api-client');
    
    // Set max errors to 2
    window.ENV.NEXT_PUBLIC_ERROR_TRACKING_MAX_ERRORS = '2';
    
    const { getByTestId } = render(
      <ErrorTrackingProvider>
        <TestComponent />
      </ErrorTrackingProvider>
    );
    
    // Trigger first error
    await act(async () => {
      getByTestId('trigger-error').click();
    });
    
    // Check that the API was called
    expect(apiClient.reportError).toHaveBeenCalledTimes(1);
    
    // Trigger second error
    await act(async () => {
      getByTestId('trigger-error').click();
    });
    
    // Check that the API was called again
    expect(apiClient.reportError).toHaveBeenCalledTimes(2);
    
    // Trigger third error (should not be reported due to max errors limit)
    await act(async () => {
      getByTestId('trigger-error').click();
    });
    
    // Check that the API was not called a third time
    expect(apiClient.reportError).toHaveBeenCalledTimes(2);
    
    // Check that the error count still incremented
    expect(getByTestId('error-count')).toHaveTextContent('3');
  });
  
  test('should apply sampling rate', async () => {
    const apiClient = require('../../lib/api-client');
    
    // Set sampling rate to 0 (no errors should be reported)
    window.ENV.NEXT_PUBLIC_ERROR_TRACKING_SAMPLING_RATE = '0';
    
    const { getByTestId } = render(
      <ErrorTrackingProvider>
        <TestComponent />
      </ErrorTrackingProvider>
    );
    
    // Trigger an error
    await act(async () => {
      getByTestId('trigger-error').click();
    });
    
    // Check that the API was not called due to sampling
    expect(apiClient.reportError).not.toHaveBeenCalled();
    
    // Check that the error count was still incremented
    expect(getByTestId('error-count')).toHaveTextContent('1');
  });
  
  test('should handle API errors gracefully', async () => {
    const apiClient = require('../../lib/api-client');
    
    // Make the API call fail
    apiClient.reportError.mockRejectedValueOnce(new Error('API error'));
    
    const { getByTestId } = render(
      <ErrorTrackingProvider>
        <TestComponent />
      </ErrorTrackingProvider>
    );
    
    // Trigger an error
    await act(async () => {
      getByTestId('trigger-error').click();
    });
    
    // Check that the error count was still incremented
    expect(getByTestId('error-count')).toHaveTextContent('1');
    
    // Trigger another error (should still work)
    await act(async () => {
      getByTestId('trigger-error').click();
    });
    
    // Check that the API was called again
    expect(apiClient.reportError).toHaveBeenCalledTimes(2);
    
    // Check that the error count was incremented again
    expect(getByTestId('error-count')).toHaveTextContent('2');
  });
});
