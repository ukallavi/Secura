/**
 * Tests for API client error reporting functionality
 */
import { reportError } from '../../lib/api-client';

// Mock fetch
global.fetch = jest.fn();

describe('API Client - Error Reporting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful response
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, id: 'mock-error-id' })
    });
  });
  
  test('should report errors to the error tracking endpoint', async () => {
    const errorData = {
      error_type: 'TEST_ERROR',
      error_message: 'Test error message',
      error_stack: 'Error: Test error message\n    at test (/app/test.js:1:1)',
      url: 'https://secura.com/test',
      context: { test: true },
      session_id: 'test-session',
      user_id: 'test-user',
      csrf_token: 'test-csrf-token'
    };
    
    const result = await reportError(errorData);
    
    expect(result).toEqual({ success: true, id: 'mock-error-id' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/error-tracking',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'test-csrf-token'
        }),
        body: JSON.stringify(errorData)
      })
    );
  });
  
  test('should handle API errors', async () => {
    // Mock error response
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: 'Server error' })
    });
    
    const errorData = {
      error_type: 'TEST_ERROR',
      error_message: 'Test error message',
      csrf_token: 'test-csrf-token'
    };
    
    await expect(reportError(errorData)).rejects.toThrow('Failed to report error: 500 Internal Server Error');
  });
  
  test('should handle network errors', async () => {
    // Mock network error
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    
    const errorData = {
      error_type: 'TEST_ERROR',
      error_message: 'Test error message',
      csrf_token: 'test-csrf-token'
    };
    
    await expect(reportError(errorData)).rejects.toThrow('Network error');
  });
  
  test('should handle invalid JSON response', async () => {
    // Mock invalid JSON response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error('Invalid JSON'))
    });
    
    const errorData = {
      error_type: 'TEST_ERROR',
      error_message: 'Test error message',
      csrf_token: 'test-csrf-token'
    };
    
    await expect(reportError(errorData)).rejects.toThrow('Invalid JSON');
  });
  
  test('should validate required fields', async () => {
    const incompleteErrorData = {
      // Missing error_type and error_message
      csrf_token: 'test-csrf-token'
    };
    
    await expect(reportError(incompleteErrorData)).rejects.toThrow('Error data must include error_type and error_message');
  });
  
  test('should validate CSRF token', async () => {
    const errorDataWithoutCsrf = {
      error_type: 'TEST_ERROR',
      error_message: 'Test error message'
      // Missing csrf_token
    };
    
    await expect(reportError(errorDataWithoutCsrf)).rejects.toThrow('CSRF token is required');
  });
});
