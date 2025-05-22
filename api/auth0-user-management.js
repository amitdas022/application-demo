// api/auth0-user-management.js
// Provides API endpoints for managing Auth0 users and their roles (e.g., create, list, update, delete users; assign/unassign roles).
// It uses an M2M (Machine-to-Machine) token to authenticate with the Auth0 Management API.

// Load environment variables from .env file in development environments
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config(); // dotenv loads variables from .env into process.env
}
import fetch from 'node-fetch'; // Used for making HTTP requests to the Auth0 Management API.

// Auth0 Tenant and M2M Application configuration from environment variables
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_M2M_CLIENT_ID = process.env.AUTH0_M2M_CLIENT_ID; // Client ID of the M2M application
const AUTH0_M2M_CLIENT_SECRET = process.env.AUTH0_M2M_CLIENT_SECRET; // Client Secret of the M2M application
const AUTH0_MANAGEMENT_AUDIENCE = process.env.AUTH0_MANAGEMENT_AUDIENCE; // Audience for the Management API (e.g., https://your-tenant.auth0.com/api/v2/)

// --- M2M Token Caching ---
let managementApiToken = null;
let tokenExpiry = 0;

// Helper to check for missing environment variables
function checkEnvVariables() {
    const requiredEnvVars = [
        'AUTH0_DOMAIN',
        'AUTH0_M2M_CLIENT_ID',
        'AUTH0_M2M_CLIENT_SECRET',
        'AUTH0_MANAGEMENT_AUDIENCE',
    ];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        throw new Error(`Missing critical environment variables for Auth0 M2M authentication: ${missingVars.join(', ')}. Server cannot operate correctly.`);
    }
}
// Call it once at startup to ensure config is present.
// If this throws, the server/lambda won't start, which is desired behavior.
try {
    checkEnvVariables();
} catch (e) {
    console.error("Startup Error:", e.message);
    // Depending on the environment, might need to process.exit(1) if this doesn't halt execution
}


function sendError(res, statusCode, message, errorDetails) {
    console.error("Auth0 Management API Error:", message, errorDetails);
    res.status(statusCode).json({ error: message, details: errorDetails?.message || errorDetails });
}

async function getManagementApiToken() {
    // Environment variables are checked at startup, but good to ensure AUTH0_DOMAIN is present for URL construction
    if (!AUTH0_DOMAIN) {
        throw new Error("AUTH0_DOMAIN is not configured."); // This should ideally be caught by startup check
    }
    if (managementApiToken && Date.now() < tokenExpiry) {
        return managementApiToken;
    }
    const tokenUrl = `https://${AUTH0_DOMAIN}/oauth/token`;
    try {
        // Variables like AUTH0_M2M_CLIENT_ID are assumed to be present due to startup check.
        const tokenRequestPayload = {
            client_id: AUTH0_M2M_CLIENT_ID,
            client_secret: AUTH0_M2M_CLIENT_SECRET,
            audience: AUTH0_MANAGEMENT_AUDIENCE,
            grant_type: 'client_credentials',
        };
        const tokenRequestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tokenRequestPayload),
        };
        const response = await fetch(tokenUrl, tokenRequestOptions);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to get Auth0 Management API token:', errorData);
            throw new Error(`Auth0 Token Error: ${errorData.error_description || response.statusText}`);
        }
        const data = await response.json();
        managementApiToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
        return managementApiToken;
    } catch (error) {
        console.error('Error fetching Auth0 Management API token:', error);
        managementApiToken = null;
        tokenExpiry = 0;
        throw error;
    }
}

// --- Action Specific Handlers ---

async function handleCreateUser(req, res, token) {
    const { userData } = req.body;
    if (!userData || !userData.email || !userData.password) {
        return sendError(res, 400, 'User data including email and password are required for user creation.');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
        return sendError(res, 400, 'Invalid email format for user creation.');
    }

    // Password validation (minimum length)
    if (userData.password.length < 8) {
        return sendError(res, 400, 'Password must be at least 8 characters long.');
    }

    // Optional: Validate firstName and lastName are strings if provided
    if (userData.firstName && typeof userData.firstName !== 'string') {
        return sendError(res, 400, 'Invalid firstName format; must be a string.');
    }
    if (userData.lastName && typeof userData.lastName !== 'string') {
        return sendError(res, 400, 'Invalid lastName format; must be a string.');
    }

    const createUserData = {
        email: userData.email,
        password: userData.password,
        given_name: userData.firstName,
        family_name: userData.lastName,
        connection: 'Username-Password-Authentication',
        email_verified: true,
    };
    const baseUrl = `${AUTH0_MANAGEMENT_AUDIENCE}users`;
    const reqOptions = {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(createUserData),
    };
    const response = await fetch(baseUrl, reqOptions);
    if (!response.ok) return sendError(res, response.status, 'Failed to create user in Auth0', await response.json());
    res.status(201).json(await response.json());
}

async function handleListUsers(req, res, token) {
    const baseUrl = `${AUTH0_MANAGEMENT_AUDIENCE}users`;
    const response = await fetch(baseUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) return sendError(res, response.status, 'Failed to list users from Auth0', await response.json());
    res.status(200).json(await response.json());
}

async function handleGetUser(req, res, token) {
    const { userId } = req.query;
    if (!userId || typeof userId !== 'string' || !userId.includes('|')) {
        return sendError(res, 400, 'Valid User ID (Auth0 sub containing "|") is required for getUser.');
    }
    const getUserUrl = `${AUTH0_MANAGEMENT_AUDIENCE}users/${encodeURIComponent(userId)}`;
    const response = await fetch(getUserUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!response.ok) return sendError(res, response.status, 'Failed to get user from Auth0', await response.json());
    res.status(200).json(await response.json());
}

async function handleListUsersInRole(req, res, token) {
    const { roleName } = req.query;
    if (!roleName || typeof roleName !== 'string' || roleName.trim() === '') {
        return sendError(res, 400, 'Non-empty roleName query parameter is required for listUsersInRole.');
    }

    const rolesApiUrl = `${AUTH0_MANAGEMENT_AUDIENCE}roles`;
    const getRoleUrl = `${rolesApiUrl}?name_filter=${encodeURIComponent(roleName)}`;
    const rolesResponse = await fetch(getRoleUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!rolesResponse.ok) return sendError(res, rolesResponse.status, `Failed to find role '${roleName}' in Auth0`, await rolesResponse.json());
    
    const rolesData = await rolesResponse.json();
    if (!rolesData || rolesData.length === 0) return sendError(res, 404, `Role '${roleName}' not found in Auth0.`);
    const roleId = rolesData[0].id;

    const usersInRoleApiUrl = `${AUTH0_MANAGEMENT_AUDIENCE}roles/${roleId}/users`;
    const usersInRoleResponse = await fetch(usersInRoleApiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!usersInRoleResponse.ok) return sendError(res, usersInRoleResponse.status, `Failed to list users in role '${roleName}' from Auth0`, await usersInRoleResponse.json());
    
    res.status(200).json(await usersInRoleResponse.json());
}

async function handleUpdateUser(req, res, token) {
    const { userId, updates } = req.body;
    if (!userId || typeof userId !== 'string' || !userId.includes('|')) {
        return sendError(res, 400, 'Valid User ID (Auth0 sub containing "|") is required for update.');
    }
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
        return sendError(res, 400, 'Update data object is required and cannot be empty.');
    }

    // Optional: Validate specific fields in updates if necessary
    if (updates.given_name && typeof updates.given_name !== 'string') {
        return sendError(res, 400, 'Invalid given_name format in updates; must be a string.');
    }
    if (updates.family_name && typeof updates.family_name !== 'string') {
        return sendError(res, 400, 'Invalid family_name format in updates; must be a string.');
    }
    // Ensure no attempts to update protected fields like 'email' or 'password' directly if not allowed
    if (updates.hasOwnProperty('email') || updates.hasOwnProperty('password')) {
        return sendError(res, 400, 'Updating email or password via this method is not permitted. Use dedicated flows.');
    }

    const updatePayload = { ...updates };
    const updateUrl = `${AUTH0_MANAGEMENT_AUDIENCE}users/${encodeURIComponent(userId)}`;
    const reqOptions = {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
    };
    const response = await fetch(updateUrl, reqOptions);
    if (!response.ok) return sendError(res, response.status, 'Failed to update user in Auth0', await response.json());
    res.status(200).json(await response.json());
}

async function handleRoleModification(req, res, token, actionType) {
    const { userId, roles } = req.body;
    if (!userId || typeof userId !== 'string' || !userId.includes('|')) {
        return sendError(res, 400, 'Valid User ID (Auth0 sub containing "|") is required for role modification.');
    }
    if (!roles || !Array.isArray(roles) || roles.some(role => typeof role !== 'string' || role.trim() === '')) {
        return sendError(res, 400, 'Roles must be a non-empty array of non-empty strings.');
    }

    const roleIdsPayload = [];
    // This example simplifies role ID lookup: directly handling 'admin' role.
    // A more robust solution would map all role names in `roles` array to their IDs.
    if (roles.includes('admin')) { // Only process 'admin' role as per original simplified logic
        const rolesApiUrl = `${AUTH0_MANAGEMENT_AUDIENCE}roles`;
        const getAdminRoleUrl = `${rolesApiUrl}?name_filter=admin`;
        const adminRoleResponse = await fetch(getAdminRoleUrl, { headers: { 'Authorization': `Bearer ${token}` } });
        if (adminRoleResponse.ok) {
            const adminRolesData = await adminRoleResponse.json();
            if (adminRolesData && adminRolesData.length > 0) {
                roleIdsPayload.push(adminRolesData[0].id);
            } else {
                // If 'admin' was specifically requested but not found, this is an issue.
                return sendError(res, 404, "The 'admin' role was not found in Auth0. Cannot assign/unassign.");
            }
        } else {
            console.error("Failed to fetch admin role ID from Auth0:", await adminRoleResponse.text());
            return sendError(res, adminRoleResponse.status, 'Failed to fetch admin role ID from Auth0. Check server logs.', await adminRoleResponse.text());
        }
    } else if (roles.length > 0) {
        // If roles array is not empty but doesn't include 'admin', and current logic only handles 'admin'.
        return sendError(res, 400, "This endpoint currently only supports management of the 'admin' role. Other roles were specified.");
    }


    // If roles array was empty, or only contained roles other than 'admin' (which we are ignoring for now),
    // and we only proceed if 'admin' was found and its ID pushed.
    if (roleIdsPayload.length === 0 && roles.includes('admin')) {
         // This case should ideally be caught by the 'admin role not found' error above.
         // Redundant check for safety, means admin was requested but ID not fetched.
        return sendError(res, 500, "Admin role ID could not be processed. Cannot proceed.");
    }
    // If roles array was empty and didn't include 'admin', roleIdsPayload will be empty.
    // The Auth0 API call might still proceed with an empty roles array, which is fine for unassigning all roles (if supported by API).
    // For assigning, it would effectively do nothing if roleIdsPayload is empty.
    // Let's ensure we only proceed if there are roles to modify for 'admin'.
    if (roles.includes('admin') && roleIdsPayload.length === 0) {
      return sendError(res, 400, "Admin role was specified, but its ID could not be found or processed.");
    }
    // If the roles array was empty to begin with, and we are assigning, it's a no-op.
    // If unassigning with empty roles, and only admin is handled, it's also a no-op if user isn't admin.
    // The current logic for unassigning all 'admin' roles will proceed with roleIdsPayload if it has the admin ID.


    const userRolesUrl = `${AUTH0_MANAGEMENT_AUDIENCE}users/${encodeURIComponent(userId)}/roles`;
    const methodForRoles = actionType === 'assignRoles' ? 'POST' : 'DELETE';
    const rolesRequestOptions = {
        method: methodForRoles,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: roleIdsPayload })
    };
    const rolesResponse = await fetch(userRolesUrl, rolesRequestOptions);
    if (!rolesResponse.ok) return sendError(res, rolesResponse.status, `Failed to ${actionType} in Auth0`, await rolesResponse.json());
    res.status(204).send();
}


async function handleDeleteUser(req, res, token) {
    const { userId } = req.body;
    if (!userId || typeof userId !== 'string' || !userId.includes('|')) {
        return sendError(res, 400, 'Valid User ID (Auth0 sub containing "|") is required for deletion.');
    }
    const deleteUrl = `${AUTH0_MANAGEMENT_AUDIENCE}users/${encodeURIComponent(userId)}`;
    const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) return sendError(res, response.status, 'Failed to delete user in Auth0', await response.json());
    res.status(204).send();
}

/**
 * Main request handler for the /api/auth0-user-management endpoint.
 * Routes requests based on HTTP method and an 'action' parameter to perform various user management tasks.
 * @param {object} req - The Express request object. Expected to contain `action` and relevant data in `body` or `query`.
 * @param {object} res - The Express response object.
 */
export default async function handler(req, res) {
    try {
        const token = await getManagementApiToken();
        const { action } = req.query; // For GET requests
        const bodyAction = req.body && req.body.action; // For POST, PUT, DELETE requests

        if (req.method === 'POST') {
            if (bodyAction === 'createUser') {
                await handleCreateUser(req, res, token);
            } else {
                sendError(res, 400, 'Invalid action for POST request.');
            }
        } else if (req.method === 'GET') {
            if (action === 'listUsers') {
                await handleListUsers(req, res, token);
            } else if (action === 'getUser') {
                await handleGetUser(req, res, token);
            } else if (action === 'listUsersInRole') {
                await handleListUsersInRole(req, res, token);
            } else {
                sendError(res, 400, 'Invalid action for GET request.');
            }
        } else if (req.method === 'PUT') {
            if (bodyAction === 'updateUser') {
                await handleUpdateUser(req, res, token);
            } else if (bodyAction === 'assignRoles') {
                await handleRoleModification(req, res, token, 'assignRoles');
            } else if (bodyAction === 'unassignRoles') {
                await handleRoleModification(req, res, token, 'unassignRoles');
            } else {
                sendError(res, 400, 'Invalid action for PUT request.');
            }
        } else if (req.method === 'DELETE') {
            if (bodyAction === 'deleteUser') {
                await handleDeleteUser(req, res, token);
            } else {
                sendError(res, 400, 'Invalid action for DELETE request.');
            }
        } else {
            res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
            sendError(res, 405, `Method ${req.method} Not Allowed`);
        }
    } catch (error) {
        sendError(res, 500, 'Auth0 Management API operation failed.', error.message || error);
    }
}

// Vercel specific configuration: enables Next.js API routes to parse the request body.
// Without this, `req.body` would be undefined for POST/PUT requests.
export const config = {
    api: {
        bodyParser: true, // Enable body parsing for this API route
    },
};