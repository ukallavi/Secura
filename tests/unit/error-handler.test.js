// tests/unit/error-handler.test.js
const { processApiError, ErrorTypes } = require('../../frontend/lib/error-handler');

// Mock the global fetch function
global.fetch = jest.fn();

describe('Error Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processApiError', () => {
    it('should process a validation error response correctly', async () => {
      // Mock response
      const mockResponse = {
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          message: 'Validation failed',
          errors: [
            { field: 'email', message: 'Invalid email format' },
            { field: 'password', message: 'Password too short' }
          ]
        })
      };

      try {
        await processApiError(mockResponse);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.VALIDATION_ERROR);
        expect(error.status).toBe(400);
        expect(error.message).toBe('Validation failed');
        expect(error.errors).toHaveLength(2);
        expect(error.errors[0].field).toBe('email');
      }
    });

    it('should process an authentication error response correctly', async () => {
      // Mock response
      const mockResponse = {
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({
          message: 'Authentication failed'
        })
      };

      try {
        await processApiError(mockResponse);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.AUTH_ERROR);
        expect(error.status).toBe(401);
        expect(error.message).toBe('Authentication failed');
      }
    });

    it('should process a forbidden error response correctly', async () => {
      // Mock response
      const mockResponse = {
        ok: false,
        status: 403,
        json: jest.fn().mockResolvedValue({
          message: 'Access denied'
        })
      };

      try {
        await processApiError(mockResponse);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.FORBIDDEN_ERROR);
        expect(error.status).toBe(403);
        expect(error.message).toBe('Access denied');
      }
    });

    it('should process a not found error response correctly', async () => {
      // Mock response
      const mockResponse = {
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({
          message: 'Resource not found'
        })
      };

      try {
        await processApiError(mockResponse);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.NOT_FOUND_ERROR);
        expect(error.status).toBe(404);
        expect(error.message).toBe('Resource not found');
      }
    });

    it('should process a rate limit error response correctly', async () => {
      // Mock response
      const mockResponse = {
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({
          message: 'Too many requests'
        })
      };

      try {
        await processApiError(mockResponse);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.RATE_LIMIT_ERROR);
        expect(error.status).toBe(429);
        expect(error.message).toBe('Too many requests');
      }
    });

    it('should process a server error response correctly', async () => {
      // Mock response
      const mockResponse = {
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({
          message: 'Internal server error'
        })
      };

      try {
        await processApiError(mockResponse);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.SERVER_ERROR);
        expect(error.status).toBe(500);
        expect(error.message).toBe('Internal server error');
      }
    });

    it('should handle a network error correctly', async () => {
      const networkError = new Error('Network error');
      
      try {
        await processApiError(networkError);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.NETWORK_ERROR);
        expect(error.message).toContain('Network error');
      }
    });

    it('should handle a JSON parsing error correctly', async () => {
      // Mock response with JSON parsing error
      const mockResponse = {
        ok: false,
        status: 200,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      };

      try {
        await processApiError(mockResponse);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.SERVER_ERROR);
        expect(error.message).toContain('Error parsing response');
      }
    });

    it('should handle verification required errors correctly', async () => {
      // Mock response
      const mockResponse = {
        ok: false,
        status: 403,
        json: jest.fn().mockResolvedValue({
          message: 'Verification required',
          requiresVerification: true,
          verificationRequirements: {
            type: 'email',
            destination: 'u***@example.com'
          }
        })
      };

      try {
        await processApiError(mockResponse);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.VERIFICATION_REQUIRED);
        expect(error.status).toBe(403);
        expect(error.message).toBe('Verification required');
        expect(error.verificationRequirements).toBeDefined();
        expect(error.verificationRequirements.type).toBe('email');
      }
    });
  });
});
