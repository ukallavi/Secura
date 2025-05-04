// tests/integration/api-client.test.js
import { PasswordsApi, UsersApi, AdminApi } from '../../frontend/lib/api-client';
import { processApiError, ErrorTypes } from '../../frontend/lib/error-handler';

// Mock fetch globally
global.fetch = jest.fn();
global.console.error = jest.fn(); // Suppress console errors

describe('API Client Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PasswordsApi', () => {
    it('should handle successful password retrieval', async () => {
      // Mock successful response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [
            { id: 1, title: 'Test Password', username: 'testuser' }
          ],
          pagination: { total: 1, page: 1, limit: 10 }
        })
      });

      const result = await PasswordsApi.getAll();
      
      expect(result.data).toBeDefined();
      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toBe('Test Password');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle authentication errors properly', async () => {
      // Mock 401 response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({
          message: 'Authentication required'
        })
      });

      try {
        await PasswordsApi.getAll();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.AUTH_ERROR);
        expect(error.status).toBe(401);
        expect(error.message).toBe('Authentication required');
      }
    });

    it('should handle validation errors properly', async () => {
      // Mock validation error response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          message: 'Validation failed',
          errors: [
            { field: 'password', message: 'Password is required' }
          ]
        })
      });

      try {
        await PasswordsApi.create({ title: 'Test', username: 'test' });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.VALIDATION_ERROR);
        expect(error.errors).toBeDefined();
        expect(error.errors[0].field).toBe('password');
      }
    });

    it('should handle network errors properly', async () => {
      // Mock network error
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await PasswordsApi.getAll();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.NETWORK_ERROR);
        expect(error.message).toContain('Network error');
      }
    });
  });

  describe('UsersApi', () => {
    it('should handle successful profile retrieval', async () => {
      // Mock successful response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: 1,
          email: 'user@example.com',
          name: 'Test User',
          role: 'user'
        })
      });

      const result = await UsersApi.getProfile();
      
      expect(result).toBeDefined();
      expect(result.email).toBe('user@example.com');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle forbidden errors properly', async () => {
      // Mock 403 response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: jest.fn().mockResolvedValue({
          message: 'Access denied'
        })
      });

      try {
        await UsersApi.getProfile();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.FORBIDDEN_ERROR);
        expect(error.status).toBe(403);
        expect(error.message).toBe('Access denied');
      }
    });
  });

  describe('AdminApi', () => {
    it('should handle successful users retrieval', async () => {
      // Mock successful response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [
            { id: 1, email: 'user1@example.com', role: 'user' },
            { id: 2, email: 'user2@example.com', role: 'admin' }
          ],
          pagination: { total: 2, page: 1, limit: 10 }
        })
      });

      const result = await AdminApi.getAllUsers();
      
      expect(result.data).toBeDefined();
      expect(result.data.length).toBe(2);
      expect(result.data[1].role).toBe('admin');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle rate limit errors properly', async () => {
      // Mock 429 response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({
          message: 'Too many requests, please try again later',
          retryAfter: 60
        })
      });

      try {
        await AdminApi.getAllUsers();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.type).toBe(ErrorTypes.RATE_LIMIT_ERROR);
        expect(error.status).toBe(429);
        expect(error.message).toBe('Too many requests, please try again later');
        expect(error.retryAfter).toBe(60);
      }
    });
  });
});
