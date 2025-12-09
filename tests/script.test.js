import script from '../src/script.mjs';

describe('Okta Update User By ID Script', () => {
  const mockContext = {
    environment: {
      ADDRESS: 'https://example.okta.com'
    },
    secrets: {
      BEARER_AUTH_TOKEN: 'test-okta-token-123456'
    },
    outputs: {}
  };

  let originalFetch;
  let originalURL;

  beforeAll(() => {
    // Save original global functions
    originalFetch = global.fetch;
    originalURL = global.URL;
  });

  beforeEach(() => {
    // Mock fetch
    global.fetch = () => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'user123',
        status: 'ACTIVE',
        created: '2024-01-15T10:00:00.000Z',
        activated: '2024-01-15T10:00:00.000Z',
        statusChanged: '2024-01-15T10:00:00.000Z',
        lastLogin: '2024-01-16T08:30:00.000Z',
        lastUpdated: '2024-01-16T14:15:00.000Z',
        profile: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          login: 'jane.smith@example.com',
          department: 'Engineering'
        }
      })
    });

    // Mock URL constructor
    global.URL = class {
      constructor(path, base) {
        this.toString = () => `${base}${path}`;
      }
    };
  });

  afterEach(() => {
    // Restore console methods
    if (console.log.mockRestore) console.log.mockRestore();
    if (console.error.mockRestore) console.error.mockRestore();
  });

  afterAll(() => {
    // Restore original global functions
    global.fetch = originalFetch;
    global.URL = originalURL;
  });

  describe('invoke handler', () => {
    test('should successfully update user with firstName only', async () => {
      const params = {
        userId: 'user123',
        firstName: 'Jane',
        address: 'https://example.okta.com'
      };

      const result = await script.invoke(params, mockContext);

      expect(result.id).toBe('user123');
      expect(result.status).toBe('ACTIVE');
      expect(result.profile.firstName).toBe('Jane');
      expect(result.profile.email).toBe('jane.smith@example.com');
    });

    test('should update user with multiple profile fields', async () => {
      const params = {
        userId: 'user123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@newdomain.com',
        department: 'Engineering',
        employeeNumber: 'EMP002',
        address: 'https://example.okta.com'
      };

      const result = await script.invoke(params, mockContext);

      expect(result.id).toBe('user123');
      expect(result.status).toBe('ACTIVE');
      expect(result.profile.department).toBe('Engineering');
    });

    test('should update user with additional profile attributes', async () => {
      const params = {
        userId: 'user123',
        firstName: 'Jane',
        additionalProfileAttributes: '{"mobilePhone": "555-5678", "title": "Senior Engineer"}',
        address: 'https://example.okta.com'
      };

      const result = await script.invoke(params, mockContext);

      expect(result.id).toBe('user123');
      expect(result.status).toBe('ACTIVE');
    });

    test('should use environment.ADDRESS when params.address is not provided', async () => {
      const params = {
        userId: 'user123',
        firstName: 'Jane'
        // No address parameter - should use environment.ADDRESS
      };

      const result = await script.invoke(params, mockContext);

      expect(result.id).toBe('user123');
      expect(result.status).toBe('ACTIVE');
      expect(result.profile.firstName).toBe('Jane');
    });

    test('should handle empty string fields by ignoring them', async () => {
      const params = {
        userId: 'user123',
        firstName: 'Jane',
        lastName: '',
        department: '  ',
        address: 'https://example.okta.com'
      };

      const result = await script.invoke(params, mockContext);

      expect(result.id).toBe('user123');
      expect(result.status).toBe('ACTIVE');
    });

    test('should throw error when no profile fields provided', async () => {
      const params = {
        userId: 'user123',
        address: 'https://example.okta.com'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('At least one profile field must be provided to update');
    });

    test('should throw error for invalid JSON in additionalProfileAttributes', async () => {
      const params = {
        userId: 'user123',
        firstName: 'Jane',
        additionalProfileAttributes: 'invalid-json',
        address: 'https://example.okta.com'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid additionalProfileAttributes JSON');
    });

    test('should throw error for missing userId', async () => {
      const params = {
        firstName: 'Jane',
        address: 'https://example.okta.com'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing userId parameter');
    });

    test('should throw error for empty userId', async () => {
      const params = {
        userId: '',
        firstName: 'Jane',
        address: 'https://example.okta.com'
      };

      await expect(script.invoke(params, mockContext))
        .rejects.toThrow('Invalid or missing userId parameter');
    });

    test('should throw error for missing address', async () => {
      const params = {
        userId: 'user123',
        firstName: 'Jane'
      };

      const contextWithoutAddress = {
        ...mockContext,
        environment: {}
      };

      await expect(script.invoke(params, contextWithoutAddress))
        .rejects.toThrow('No URL specified. Provide address parameter or ADDRESS environment variable');
    });

    test('should throw error for missing BEARER_AUTH_TOKEN', async () => {
      const params = {
        userId: 'user123',
        firstName: 'Jane',
        address: 'https://example.okta.com'
      };

      const contextWithoutToken = {
        ...mockContext,
        secrets: {}
      };

      await expect(script.invoke(params, contextWithoutToken))
        .rejects.toThrow('No authentication configured');
    });

    test('should handle API error with errorSummary', async () => {
      const params = {
        userId: 'user123',
        firstName: 'Jane',
        address: 'https://example.okta.com'
      };

      global.fetch = () => Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({
          errorCode: 'E0000007',
          errorSummary: 'Not found: Resource not found: user123 (User)',
          errorLink: 'E0000007',
          errorId: 'oae456'
        })
      });

      const error = await script.invoke(params, mockContext).catch(e => e);
      expect(error.message).toBe('Failed to update user: Not found: Resource not found: user123 (User)');
      expect(error.statusCode).toBe(404);
    });

    test('should handle API error without JSON body', async () => {
      const params = {
        userId: 'user123',
        firstName: 'Jane',
        address: 'https://example.okta.com'
      };

      global.fetch = () => Promise.resolve({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Not JSON');
        }
      });

      const error = await script.invoke(params, mockContext).catch(e => e);
      expect(error.message).toBe('Failed to update user: HTTP 500');
      expect(error.statusCode).toBe(500);
    });

    test('should use userId directly in URL without encoding', async () => {
      let capturedUrl;
      global.fetch = (url) => {
        capturedUrl = url;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'user123',
            status: 'ACTIVE',
            created: '2024-01-15T10:00:00.000Z',
            activated: '2024-01-15T10:00:00.000Z',
            statusChanged: '2024-01-15T10:00:00.000Z',
            lastLogin: null,
            lastUpdated: '2024-01-15T10:00:00.000Z',
            profile: {
              firstName: 'Test',
              lastName: 'User',
              email: 'test.user@example.com',
              login: 'test.user@example.com'
            }
          })
        });
      };

      const params = {
        userId: 'user123',
        firstName: 'Test',
        address: 'https://example.okta.com'
      };

      await script.invoke(params, mockContext);

      // Verify that the URL contains the userId directly (no encoding needed)
      expect(capturedUrl).toContain('user123');
      expect(capturedUrl).toContain('https://example.okta.com/api/v1/users/user123');
    });
  });

  describe('error handler', () => {
    test('should re-throw error for framework to handle', async () => {
      const params = {
        userId: 'user123',
        error: new Error('Network timeout')
      };

      await expect(script.error(params, mockContext))
        .rejects.toThrow('Network timeout');
    });
  });

  describe('halt handler', () => {
    test('should handle graceful shutdown', async () => {
      const params = {
        userId: 'user123',
        reason: 'timeout'
      };

      const result = await script.halt(params, mockContext);

      expect(result.userId).toBe('user123');
      expect(result.reason).toBe('timeout');
      expect(result.haltedAt).toBeDefined();
      expect(result.cleanupCompleted).toBe(true);
    });

    test('should handle halt with missing params', async () => {
      const params = {
        reason: 'system_shutdown'
      };

      const result = await script.halt(params, mockContext);

      expect(result.userId).toBe('unknown');
      expect(result.reason).toBe('system_shutdown');
      expect(result.cleanupCompleted).toBe(true);
    });
  });
});