import httpMocks from 'node-mocks-http';
import fetch from 'node-fetch';
// Import the handler directly - ensure this path is correct
import managementApiHandler from '../auth0-user-management'; 
// We might need to re-import or spy on getManagementApiToken if we want to test its caching behavior specifically
// For now, we'll test it implicitly via the main handler.

const { Response } = jest.requireActual('node-fetch');

// Mock 'node-fetch'
jest.mock('node-fetch');

describe('/api/auth0-user-management Endpoint', () => {
  let OLD_ENV;
  const mockManagementApiToken = 'mock-m2m-token';

  // Helper to set up environment variables for tests
  const setupEnvVars = () => {
    process.env.AUTH0_DOMAIN = 'test-domain.auth0.com';
    process.env.AUTH0_M2M_CLIENT_ID = 'test-m2m-client-id';
    process.env.AUTH0_M2M_CLIENT_SECRET = 'test-m2m-client-secret';
    process.env.AUTH0_MANAGEMENT_AUDIENCE = 'https://test-domain.auth0.com/api/v2/';
    process.env.NODE_ENV = 'test';
  };

  beforeEach(() => {
    fetch.mockClear(); // Clear mock usage data
    OLD_ENV = { ...process.env }; // Shallow copy
    setupEnvVars(); // Setup necessary env vars for most tests

    // Default mock for getManagementApiToken (via its internal fetch call)
    // This simulates a successful M2M token fetch when the main handler calls getManagementApiToken
    fetch.mockImplementation((url) => {
      if (url.includes('/oauth/token')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: mockManagementApiToken,
              expires_in: 3600,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }
      // Fallback for other fetches, specific tests will override this
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });
  });

  afterEach(() => {
    process.env = OLD_ENV; // Restore original environment
    jest.resetModules(); // Reset modules to clear cache for env variable changes
  });

  describe('Environment Variable Checks (Startup)', () => {
    // This test is a bit conceptual as checkEnvVariables runs at import time.
    // We test its behavior by manipulating env vars and re-importing the module.
    it('should throw an error if critical environment variables are missing', () => {
      delete process.env.AUTH0_DOMAIN; // Remove a critical variable
      // The error is thrown when the module is imported.
      // We expect the test runner or module system to catch this.
      // For Jest, we can try to re-import the module and catch the error.
      let error;
      try {
        jest.isolateModules(() => {
          require('../auth0-user-management');
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toContain('Missing critical environment variables');
      expect(error.message).toContain('AUTH0_DOMAIN');
    });
  });
  
  describe('Main Handler Routing', () => {
    it('should return 405 for unsupported HTTP methods', async () => {
        const req = httpMocks.createRequest({ method: 'PATCH', url: '/api/auth0-user-management' });
        const res = httpMocks.createResponse();
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(405);
        expect(res._getJSONData().error).toBe('Method PATCH Not Allowed');
    });
  });

  // Test individual handlers
  describe('handleCreateUser', () => {
    const createUserPayload = {
      email: 'newuser@example.com',
      password: 'password12345',
      firstName: 'New',
      lastName: 'User',
    };

    it('should create a user successfully (201)', async () => {
      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/auth0-user-management',
        body: {
          action: 'createUser',
          userData: createUserPayload,
        },
      });
      const res = httpMocks.createResponse();

      // Specific mock for the createUser Auth0 API call
      fetch.mockImplementation((url) => {
        if (url.includes('/oauth/token')) { // M2M token
          return Promise.resolve(new Response(JSON.stringify({ access_token: mockManagementApiToken, expires_in: 3600 }), { status: 200 }));
        }
        if (url.endsWith('/api/v2/users') && fetch.mock.calls[fetch.mock.calls.length -1][1].method === 'POST') { // Create user call
          return Promise.resolve(new Response(JSON.stringify({ ...createUserPayload, user_id: 'auth0|newUser123' }), { status: 201 }));
        }
        return Promise.resolve(new Response(JSON.stringify({}), { status: 404 })); // Default for unexpected
      });
      
      await managementApiHandler(req, res);

      expect(res.statusCode).toBe(201);
      const responseData = res._getJSONData();
      expect(responseData.email).toBe(createUserPayload.email);
      expect(responseData.user_id).toBe('auth0|newUser123');
      // Check that fetch for M2M token was called, then for createUser
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/oauth/token'), expect.any(Object));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v2/users'), expect.objectContaining({ method: 'POST' }));
    });

    it('should return 400 for missing email in userData', async () => {
      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/auth0-user-management',
        body: {
          action: 'createUser',
          userData: { password: 'password123' },
        },
      });
      const res = httpMocks.createResponse();
      await managementApiHandler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().error).toContain('User data including email and password are required');
    });
    
    it('should return 400 for invalid email format', async () => {
        const req = httpMocks.createRequest({
          method: 'POST',
          url: '/api/auth0-user-management',
          body: {
            action: 'createUser',
            userData: { ...createUserPayload, email: 'invalidemail' },
          },
        });
        const res = httpMocks.createResponse();
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res._getJSONData().error).toBe('Invalid email format for user creation.');
    });

    it('should return 400 for password too short', async () => {
        const req = httpMocks.createRequest({
          method: 'POST',
          url: '/api/auth0-user-management',
          body: {
            action: 'createUser',
            userData: { ...createUserPayload, password: 'short' },
          },
        });
        const res = httpMocks.createResponse();
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res._getJSONData().error).toBe('Password must be at least 8 characters long.');
    });

    it('should return Auth0 error on creation failure', async () => {
        const req = httpMocks.createRequest({
            method: 'POST',
            url: '/api/auth0-user-management',
            body: { action: 'createUser', userData: createUserPayload }
        });
        const res = httpMocks.createResponse();

        fetch.mockImplementation((url, options) => {
            if (url.includes('/oauth/token')) {
                return Promise.resolve(new Response(JSON.stringify({ access_token: mockManagementApiToken, expires_in: 3600 }), { status: 200 }));
            }
            if (options && options.method === 'POST' && url.includes('/api/v2/users')) { // Create user call
                 return Promise.resolve(new Response(JSON.stringify({ error: 'Auth0_Error', message: 'User already exists' }), { status: 409 })); // Conflict
            }
            return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
        });
        
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(409);
        expect(res._getJSONData().error).toBe('Failed to create user in Auth0');
        expect(res._getJSONData().details.error).toBe('Auth0_Error');
    });
  });

  describe('handleListUsers', () => {
    it('should list users successfully (200)', async () => {
        const req = httpMocks.createRequest({
            method: 'GET',
            url: '/api/auth0-user-management?action=listUsers',
        });
        const res = httpMocks.createResponse();
        const mockUsers = [{ id: 'auth0|u1', email: 'u1@example.com'}, { id: 'auth0|u2', email: 'u2@example.com'}];

        fetch.mockImplementation((url, options) => {
            if (url.includes('/oauth/token')) {
                return Promise.resolve(new Response(JSON.stringify({ access_token: mockManagementApiToken, expires_in: 3600 }), { status: 200 }));
            }
            if (options && options.headers && options.headers['Authorization'] === `Bearer ${mockManagementApiToken}` && url.includes('/api/v2/users') && !url.includes('roles')) { 
                 return Promise.resolve(new Response(JSON.stringify(mockUsers), { status: 200 }));
            }
            return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
        });

        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(200);
        expect(res._getJSONData()).toEqual(mockUsers);
    });

    it('should return Auth0 error on list users failure', async () => {
        const req = httpMocks.createRequest({
            method: 'GET',
            url: '/api/auth0-user-management?action=listUsers',
        });
        const res = httpMocks.createResponse();

        fetch.mockImplementation((url, options) => {
            if (url.includes('/oauth/token')) {
                return Promise.resolve(new Response(JSON.stringify({ access_token: mockManagementApiToken, expires_in: 3600 }), { status: 200 }));
            }
            if (url.includes('/api/v2/users') && !url.includes('roles')) { // List users call
                 return Promise.resolve(new Response(JSON.stringify({ error: 'Auth0_Error', message: 'Service unavailable' }), { status: 503 }));
            }
            return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
        });

        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(503);
        expect(res._getJSONData().error).toBe('Failed to list users from Auth0');
    });
  });

  describe('handleGetUser', () => {
    const userId = 'auth0|testuser123';
    it('should get a user successfully (200)', async () => {
        const req = httpMocks.createRequest({
            method: 'GET',
            url: `/api/auth0-user-management?action=getUser&userId=${userId}`,
        });
        const res = httpMocks.createResponse();
        const mockUser = { id: userId, email: 'test@example.com' };

        fetch.mockImplementation((url, options) => {
            if (url.includes('/oauth/token')) {
                return Promise.resolve(new Response(JSON.stringify({ access_token: mockManagementApiToken, expires_in: 3600 }), { status: 200 }));
            }
            if (url.includes(`/api/v2/users/${encodeURIComponent(userId)}`)) {
                 return Promise.resolve(new Response(JSON.stringify(mockUser), { status: 200 }));
            }
            return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
        });
        
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(200);
        expect(res._getJSONData()).toEqual(mockUser);
    });
    
    it('should return 400 if userId is missing or invalid', async () => {
        const req = httpMocks.createRequest({
            method: 'GET',
            url: `/api/auth0-user-management?action=getUser&userId=invaliduserid`, // No pipe
        });
        const res = httpMocks.createResponse();
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res._getJSONData().error).toContain('Valid User ID (Auth0 sub containing "|") is required');
    });
  });

  describe('handleDeleteUser', () => {
    const userIdToDelete = 'auth0|deleteme';
    it('should delete a user successfully (204)', async () => {
        const req = httpMocks.createRequest({
            method: 'DELETE',
            url: `/api/auth0-user-management`,
            body: { action: 'deleteUser', userId: userIdToDelete }
        });
        const res = httpMocks.createResponse();

        fetch.mockImplementation((url, options) => {
            if (url.includes('/oauth/token')) {
                return Promise.resolve(new Response(JSON.stringify({ access_token: mockManagementApiToken, expires_in: 3600 }), { status: 200 }));
            }
            if (options && options.method === 'DELETE' && url.includes(`/api/v2/users/${encodeURIComponent(userIdToDelete)}`)) {
                 return Promise.resolve(new Response(null, { status: 204 })); // No content for successful delete
            }
            return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
        });

        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(204);
    });

    it('should return 400 if userId is missing for delete', async () => {
        const req = httpMocks.createRequest({
            method: 'DELETE',
            url: `/api/auth0-user-management`,
            body: { action: 'deleteUser' } // Missing userId
        });
        const res = httpMocks.createResponse();
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res._getJSONData().error).toContain('Valid User ID (Auth0 sub containing "|") is required');
    });
  });
  
  describe('handleListUsersInRole', () => {
    const roleName = 'admin';
    const roleId = 'rol_admin123';
    const mockUsersInRole = [{ id: 'auth0|u1', email: 'u1@example.com'}];

    it('should list users in a role successfully (200)', async () => {
        const req = httpMocks.createRequest({
            method: 'GET',
            url: `/api/auth0-user-management?action=listUsersInRole&roleName=${roleName}`,
        });
        const res = httpMocks.createResponse();

        fetch.mockImplementation((url, options) => {
            if (url.includes('/oauth/token')) { // M2M token
                return Promise.resolve(new Response(JSON.stringify({ access_token: mockManagementApiToken, expires_in: 3600 }), { status: 200 }));
            }
            if (url.includes(`/api/v2/roles?name_filter=${encodeURIComponent(roleName)}`)) { // Get Role ID
                return Promise.resolve(new Response(JSON.stringify([{ id: roleId, name: roleName }]), { status: 200 }));
            }
            if (url.includes(`/api/v2/roles/${roleId}/users`)) { // Get users in role
                return Promise.resolve(new Response(JSON.stringify(mockUsersInRole), { status: 200 }));
            }
            return Promise.resolve(new Response(JSON.stringify({message: "Unexpected URL: " + url}), { status: 404 }));
        });

        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(200);
        expect(res._getJSONData()).toEqual(mockUsersInRole);
    });

    it('should return 400 if roleName is missing', async () => {
        const req = httpMocks.createRequest({
            method: 'GET',
            url: `/api/auth0-user-management?action=listUsersInRole`,
        });
        const res = httpMocks.createResponse();
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res._getJSONData().error).toContain('Non-empty roleName query parameter is required');
    });
    
    it('should return 404 if role is not found', async () => {
        const req = httpMocks.createRequest({
            method: 'GET',
            url: `/api/auth0-user-management?action=listUsersInRole&roleName=nonexistentrole`,
        });
        const res = httpMocks.createResponse();
        fetch.mockImplementation((url, options) => {
            if (url.includes('/oauth/token')) {
                return Promise.resolve(new Response(JSON.stringify({ access_token: mockManagementApiToken, expires_in: 3600 }), { status: 200 }));
            }
            if (url.includes(`/api/v2/roles?name_filter=nonexistentrole`)) { // Get Role ID
                return Promise.resolve(new Response(JSON.stringify([]), { status: 200 })); // Role not found
            }
            return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
        });
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(404);
        expect(res._getJSONData().error).toContain("Role 'nonexistentrole' not found in Auth0.");
    });
  });

  describe('handleUpdateUser', () => {
    const userIdToUpdate = 'auth0|updateme';
    const updatePayload = { given_name: 'UpdatedName' };

    it('should update a user successfully (200)', async () => {
        const req = httpMocks.createRequest({
            method: 'PUT',
            url: `/api/auth0-user-management`,
            body: { action: 'updateUser', userId: userIdToUpdate, updates: updatePayload }
        });
        const res = httpMocks.createResponse();
        
        fetch.mockImplementation((url, options) => {
            if (url.includes('/oauth/token')) {
                return Promise.resolve(new Response(JSON.stringify({ access_token: mockManagementApiToken, expires_in: 3600 }), { status: 200 }));
            }
            if (options && options.method === 'PATCH' && url.includes(`/api/v2/users/${encodeURIComponent(userIdToUpdate)}`)) {
                 return Promise.resolve(new Response(JSON.stringify({ ...updatePayload, id: userIdToUpdate }), { status: 200 }));
            }
            return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
        });

        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(200);
        expect(res._getJSONData().given_name).toBe('UpdatedName');
    });

    it('should return 400 if trying to update email', async () => {
        const req = httpMocks.createRequest({
            method: 'PUT',
            url: `/api/auth0-user-management`,
            body: { action: 'updateUser', userId: userIdToUpdate, updates: { email: 'new@example.com' } }
        });
        const res = httpMocks.createResponse();
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res._getJSONData().error).toContain('Updating email or password via this method is not permitted');
    });
    
    it('should return 400 if userId is invalid for update', async () => {
        const req = httpMocks.createRequest({
            method: 'PUT',
            url: `/api/auth0-user-management`,
            body: { action: 'updateUser', userId: 'invalidId', updates: updatePayload }
        });
        const res = httpMocks.createResponse();
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res._getJSONData().error).toContain('Valid User ID (Auth0 sub containing "|") is required for update');
    });
  });

  describe('handleRoleModification', () => {
    const userIdForRoles = 'auth0|userforroles';
    const adminRoleId = 'rol_admin123';

    it('should assign admin role successfully (204)', async () => {
        const req = httpMocks.createRequest({
            method: 'PUT',
            url: `/api/auth0-user-management`,
            body: { action: 'assignRoles', userId: userIdForRoles, roles: ['admin'] }
        });
        const res = httpMocks.createResponse();

        fetch.mockImplementation((url, options) => {
            if (url.includes('/oauth/token')) { // M2M token
                return Promise.resolve(new Response(JSON.stringify({ access_token: mockManagementApiToken, expires_in: 3600 }), { status: 200 }));
            }
            if (url.includes(`/api/v2/roles?name_filter=admin`)) { // Get Admin Role ID
                return Promise.resolve(new Response(JSON.stringify([{ id: adminRoleId, name: 'admin' }]), { status: 200 }));
            }
            if (options && options.method === 'POST' && url.includes(`/api/v2/users/${encodeURIComponent(userIdForRoles)}/roles`)) { // Assign role
                expect(JSON.parse(options.body).roles).toEqual([adminRoleId]);
                return Promise.resolve(new Response(null, { status: 204 }));
            }
            return Promise.resolve(new Response(JSON.stringify({message: "Unexpected URL: " + url}), { status: 404 }));
        });
        
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(204);
    });

    it('should unassign admin role successfully (204)', async () => {
        const req = httpMocks.createRequest({
            method: 'PUT',
            url: `/api/auth0-user-management`,
            body: { action: 'unassignRoles', userId: userIdForRoles, roles: ['admin'] }
        });
        const res = httpMocks.createResponse();

        fetch.mockImplementation((url, options) => {
            if (url.includes('/oauth/token')) {
                return Promise.resolve(new Response(JSON.stringify({ access_token: mockManagementApiToken, expires_in: 3600 }), { status: 200 }));
            }
            if (url.includes(`/api/v2/roles?name_filter=admin`)) {
                return Promise.resolve(new Response(JSON.stringify([{ id: adminRoleId, name: 'admin' }]), { status: 200 }));
            }
            if (options && options.method === 'DELETE' && url.includes(`/api/v2/users/${encodeURIComponent(userIdForRoles)}/roles`)) {
                expect(JSON.parse(options.body).roles).toEqual([adminRoleId]);
                return Promise.resolve(new Response(null, { status: 204 }));
            }
            return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
        });

        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(204);
    });
    
    it('should return 400 if roles array is invalid', async () => {
        const req = httpMocks.createRequest({
            method: 'PUT',
            url: `/api/auth0-user-management`,
            body: { action: 'assignRoles', userId: userIdForRoles, roles: ['admin', ''] } // Empty string in roles
        });
        const res = httpMocks.createResponse();
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res._getJSONData().error).toContain('Roles must be a non-empty array of non-empty strings.');
    });

    it('should return 404 if admin role not found during assignment', async () => {
        const req = httpMocks.createRequest({
            method: 'PUT',
            url: `/api/auth0-user-management`,
            body: { action: 'assignRoles', userId: userIdForRoles, roles: ['admin'] }
        });
        const res = httpMocks.createResponse();
        fetch.mockImplementation((url, options) => {
            if (url.includes('/oauth/token')) {
                return Promise.resolve(new Response(JSON.stringify({ access_token: mockManagementApiToken, expires_in: 3600 }), { status: 200 }));
            }
            if (url.includes(`/api/v2/roles?name_filter=admin`)) { // Get Admin Role ID
                return Promise.resolve(new Response(JSON.stringify([]), { status: 200 })); // Admin role not found
            }
            return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
        });
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(404);
        expect(res._getJSONData().error).toBe("The 'admin' role was not found in Auth0. Cannot assign/unassign.");
    });
    
    it('should return 400 if roles array contains non-admin roles (as per current simplified logic)', async () => {
        const req = httpMocks.createRequest({
            method: 'PUT',
            url: `/api/auth0-user-management`,
            body: { action: 'assignRoles', userId: userIdForRoles, roles: ['editor'] }
        });
        const res = httpMocks.createResponse();
        // No need to mock fetch for role lookup as it should fail validation before that.
        await managementApiHandler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res._getJSONData().error).toBe("This endpoint currently only supports management of the 'admin' role. Other roles were specified.");
    });
  });
});
