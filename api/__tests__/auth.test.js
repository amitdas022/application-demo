import httpMocks from 'node-mocks-http';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import authHandler from '../auth'; // Adjust path as necessary

// Mock a specific environment variable
const mockRolesNamespace = 'https://my-app.example.com/';

// Mock 'node-fetch'
jest.mock('node-fetch');
// Mock 'jsonwebtoken'
jest.mock('jsonwebtoken');

describe('/api/auth Endpoint', () => {
  let OLD_ENV;

  beforeEach(() => {
    // Reset mocks for each test
    fetch.mockClear();
    jwt.decode.mockClear();

    // Save old environment variables and set new ones for tests
    OLD_ENV = process.env;
    process.env = {
      ...OLD_ENV,
      AUTH0_DOMAIN: 'test-domain.auth0.com',
      AUTH0_CLIENT_ID: 'test-client-id',
      AUTH0_CLIENT_SECRET: 'test-client-secret',
      AUTH0_AUDIENCE: 'test-audience',
      AUTH0_ROLES_NAMESPACE: mockRolesNamespace,
      NODE_ENV: 'test' // ensure dotenv is not loaded if it's conditional
    };
  });

  afterEach(() => {
    // Restore old environment variables
    process.env = OLD_ENV;
  });

  describe('Successful Login', () => {
    it('should return 200 with tokens and user profile on successful authentication', async () => {
      const mockReq = httpMocks.createRequest({
        method: 'POST',
        url: '/api/auth',
        body: {
          username: 'test@example.com',
          password: 'password123',
        },
      });
      const mockRes = httpMocks.createResponse();

      const mockAuth0Response = {
        access_token: 'mockAccessToken',
        id_token: 'mockIdToken',
        refresh_token: 'mockRefreshToken',
        expires_in: 3600,
      };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAuth0Response,
      });

      const mockDecodedToken = {
        sub: 'auth0|user123',
        given_name: 'Test',
        family_name: 'User',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'http://example.com/testuser.jpg',
        [`${mockRolesNamespace}roles`]: ['user', 'editor'],
      };
      jwt.decode.mockReturnValueOnce(mockDecodedToken);

      await authHandler(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(200);
      const responseData = mockRes._getJSONData();
      expect(responseData.accessToken).toBe('mockAccessToken');
      expect(responseData.idToken).toBe('mockIdToken');
      expect(responseData.refreshToken).toBe('mockRefreshToken');
      expect(responseData.profile.id).toBe('auth0|user123');
      expect(responseData.profile.email).toBe('test@example.com');
      expect(responseData.profile.firstName).toBe('Test');
      expect(responseData.roles).toEqual(['user', 'editor']);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(jwt.decode).toHaveBeenCalledWith('mockIdToken');
    });
  });

  describe('Failed Login Scenarios', () => {
    it('should return 401 on Auth0 authentication failure (invalid credentials)', async () => {
      const mockReq = httpMocks.createRequest({
        method: 'POST',
        url: '/api/auth',
        body: {
          username: 'wrong@example.com',
          password: 'wrongpassword',
        },
      });
      const mockRes = httpMocks.createResponse();

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401, // Unauthorized or Forbidden for bad credentials
        json: async () => ({ error: 'unauthorized', error_description: 'Invalid credentials.' }),
      });

      await authHandler(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(401);
      const responseData = mockRes._getJSONData();
      expect(responseData.error).toBe('Auth0 authentication failed.');
      expect(responseData.details.error_description).toBe('Invalid credentials.');
    });

    it('should return 400 if username is missing', async () => {
      const mockReq = httpMocks.createRequest({
        method: 'POST',
        url: '/api/auth',
        body: {
          password: 'password123',
        },
      });
      const mockRes = httpMocks.createResponse();
      await authHandler(mockReq, mockRes);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes._getJSONData().error).toBe('Username and password are required.');
    });
    
    it('should return 400 if password is missing', async () => {
        const mockReq = httpMocks.createRequest({
          method: 'POST',
          url: '/api/auth',
          body: {
            username: 'test@example.com',
          },
        });
        const mockRes = httpMocks.createResponse();
        await authHandler(mockReq, mockRes);
        expect(mockRes.statusCode).toBe(400);
        expect(mockRes._getJSONData().error).toBe('Username and password are required.');
      });

    it('should return 400 if username is not a valid email', async () => {
      const mockReq = httpMocks.createRequest({
        method: 'POST',
        url: '/api/auth',
        body: {
          username: 'notanemail',
          password: 'password123',
        },
      });
      const mockRes = httpMocks.createResponse();
      await authHandler(mockReq, mockRes);
      expect(mockRes.statusCode).toBe(400);
      expect(mockRes._getJSONData().error).toBe('Invalid username format. Please use a valid email address.');
    });
  });

  describe('Auth0 Service Issues', () => {
    it('should return 503 if Auth0 service is unavailable (network error)', async () => {
      const mockReq = httpMocks.createRequest({
        method: 'POST',
        url: '/api/auth',
        body: {
          username: 'test@example.com',
          password: 'password123',
        },
      });
      const mockRes = httpMocks.createResponse();

      // Simulate a network error from fetch
      fetch.mockRejectedValueOnce({ type: 'system', code: 'ENOTFOUND' }); // Common network error

      await authHandler(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(503);
      const responseData = mockRes._getJSONData();
      expect(responseData.error).toBe('Service unavailable. Please try again later.');
      expect(responseData.details).toBe('Network or system error reaching authentication service.');
    });

    it('should return 500 if ID token is not returned from Auth0', async () => {
        const mockReq = httpMocks.createRequest({
          method: 'POST',
          url: '/api/auth',
          body: {
            username: 'test@example.com',
            password: 'password123',
          },
        });
        const mockRes = httpMocks.createResponse();
  
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'mockAccessToken' }), // No id_token
        });
  
        await authHandler(mockReq, mockRes);
  
        expect(mockRes.statusCode).toBe(500);
        expect(mockRes._getJSONData().error).toBe('Authentication successful, but ID token was not returned.');
      });

      it('should return 500 if ID token decoding fails', async () => {
        const mockReq = httpMocks.createRequest({
            method: 'POST',
            url: '/api/auth',
            body: {
              username: 'test@example.com',
              password: 'password123',
            },
          });
        const mockRes = httpMocks.createResponse();

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id_token: 'malformedOrInvalidIdToken' }),
        });
        jwt.decode.mockReturnValueOnce(null); // Simulate decoding returning null

        await authHandler(mockReq, mockRes);

        expect(mockRes.statusCode).toBe(500);
        expect(mockRes._getJSONData().error).toBe('Failed to process user identity.');
        expect(mockRes._getJSONData().details).toContain('ID token could not be decoded or is malformed.');
      });
  });
  
  describe('Unsupported HTTP Method', () => {
    it('should return 405 if method is not POST', async () => {
      const mockReq = httpMocks.createRequest({
        method: 'GET',
        url: '/api/auth',
      });
      const mockRes = httpMocks.createResponse();
      await authHandler(mockReq, mockRes);
      expect(mockRes.statusCode).toBe(405);
      expect(mockRes._getJSONData().error).toBe('Method GET Not Allowed');
    });
  });
});
