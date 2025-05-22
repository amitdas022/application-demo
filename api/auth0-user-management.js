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
// Cache for the Auth0 Management API token to avoid requesting a new one for every API call.
let managementApiToken = null; // Stores the current M2M access token.
let tokenExpiry = 0; // Stores the expiration timestamp of the current M2M token.

/**
 * Helper function to send standardized error responses.
 * @param {object} res - The Express response object.
 * @param {number} statusCode - The HTTP status code to send.
 * @param {string} message - A human-readable error message.
 * @param {object|string} [errorDetails] - Optional additional details about the error.
 */
function sendError(res, statusCode, message, errorDetails) {
    console.error("Auth0 Management API Error:", message, errorDetails);
    res.status(statusCode).json({ error: message, details: errorDetails?.message || errorDetails });
}

/**
 * Fetches and caches an M2M access token for the Auth0 Management API.
 * If a valid, non-expired token is already cached, it returns the cached token.
 * Otherwise, it requests a new token from Auth0 using client credentials grant.
 * @returns {Promise<string>} A promise that resolves to the M2M access token.
 * @throws {Error} If fetching the token fails.
 */
async function getManagementApiToken() {
    // Check if a valid, non-expired token is already cached
    if (managementApiToken && Date.now() < tokenExpiry) {
        return managementApiToken; // Return cached token
    }

    // Construct the URL for Auth0's token endpoint
    const tokenUrl = `https://${AUTH0_DOMAIN}/oauth/token`;
    try {
        // Prepare the request to Auth0 for an M2M token
        const tokenRequestPayload = {
            client_id: AUTH0_M2M_CLIENT_ID,       // Client ID of your M2M application
            client_secret: AUTH0_M2M_CLIENT_SECRET, // Client Secret of your M2M application
            audience: AUTH0_MANAGEMENT_AUDIENCE,  // Audience identifier for the Auth0 Management API
            grant_type: 'client_credentials',   // Specifies the M2M grant type
        };
        const tokenRequestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tokenRequestPayload),
        };

        // Fetch the M2M token from Auth0
        const response = await fetch(tokenUrl, tokenRequestOptions);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to get Auth0 Management API token:', errorData);
            throw new Error(`Auth0 Token Error: ${errorData.error_description || response.statusText}`);
        }

        // Parse the successful token response
        const data = await response.json();
        managementApiToken = data.access_token; // Cache the new token
        // Calculate expiry: current time + (token lifetime in seconds - 5 minutes buffer) * 1000 ms
        tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
        return managementApiToken;
    } catch (error) {
        console.error('Error fetching Auth0 Management API token:', error);
        managementApiToken = null; // Clear token on error
        tokenExpiry = 0;
        throw error; // Re-throw to be caught by the main handler
    }
}

/**
 * Main request handler for the /api/auth0-user-management endpoint.
 * Routes requests based on HTTP method and an 'action' parameter to perform various user management tasks.
 * @param {object} req - The Express request object. Expected to contain `action` and relevant data in `body` or `query`.
 * @param {object} res - The Express response object.
 */
export default async function handler(req, res) {
    // Extract action and parameters from request body (for POST, PUT, DELETE) or query string (for GET)
    const { action, userId, userData, updates, roles } = req.query; // For POST, PUT, DELETE
    const queryAction = req.query.action; // For GET actions
    const queryUserId = req.query.userId; // For GET actions requiring a user ID

    try {
        // Obtain a valid M2M token for authenticating with the Auth0 Management API
        const token = await getManagementApiToken();
        // Base URL for Auth0 Management API users endpoint
        const baseUrl = `${AUTH0_MANAGEMENT_AUDIENCE}users`; // e.g., https://YOUR_DOMAIN/api/v2/users

        // --- Handle POST Requests (e.g., create user) ---
        if (req.method === 'POST') {
            // Action: Create a new user
            if (action === 'createUser') {
                // Validate required user data
                if (!userData || !userData.email || !userData.password) {
                    return sendError(res, 400, 'Email and password are required for user creation.');
                }
                // Prepare user data payload for Auth0
                const createUserData = {
                    email: userData.email,
                    password: userData.password, // User's initial password
                    given_name: userData.firstName,
                    family_name: userData.lastName,
                    connection: 'Username-Password-Authentication', // Specify the Auth0 connection (default DB)
                    email_verified: true, // Optionally mark email as verified
                    // Add other user attributes as needed (e.g., app_metadata, user_metadata)
                };
                // Configure and make the request to create the user
                const reqOptions = {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(createUserData),
                };
                const response = await fetch(baseUrl, reqOptions);
                // Handle response from Auth0
                if (!response.ok) return sendError(res, response.status, 'Failed to create user in Auth0', await response.json());
                res.status(201).json(await response.json()); // Send back the created user object
            } else {
                sendError(res, 400, 'Invalid action for POST request.');
            }
        // --- Handle GET Requests (e.g., list users, get user) ---
        } else if (req.method === 'GET') {
            // Action: List all users
            if (queryAction === 'listUsers') {
                const response = await fetch(baseUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                if (!response.ok) return sendError(res, response.status, 'Failed to list users from Auth0', await response.json());
                res.status(200).json(await response.json());
            // Action: Get a specific user by ID
            } else if (queryAction === 'getUser') {
                if (!queryUserId) return sendError(res, 400, 'User ID (Auth0 sub) is required for getUser.');
                const getUserUrl = `${baseUrl}/${encodeURIComponent(queryUserId)}`; // URL for specific user
                const response = await fetch(getUserUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                if (!response.ok) return sendError(res, response.status, 'Failed to get user from Auth0', await response.json());
                res.status(200).json(await response.json());
            // Action: List users assigned to a specific role
            } else if (queryAction === 'listUsersInRole') {
                const roleName = req.query.roleName; // Role name passed as a query parameter
                if (!roleName) return sendError(res, 400, 'roleName query parameter is required for listUsersInRole.');

                // Step 1: Get Role ID from Role Name.
                // Auth0 Management API requires Role ID to list users in a role.
                const rolesApiUrl = `${AUTH0_MANAGEMENT_AUDIENCE}roles`;
                const getRoleUrl = `${rolesApiUrl}?name_filter=${encodeURIComponent(roleName)}`;
                const rolesResponse = await fetch(getRoleUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                if (!rolesResponse.ok) return sendError(res, rolesResponse.status, `Failed to find role '${roleName}' in Auth0`, await rolesResponse.json());
                
                const rolesData = await rolesResponse.json();
                if (!rolesData || rolesData.length === 0) return sendError(res, 404, `Role '${roleName}' not found in Auth0.`);
                const roleId = rolesData[0].id; // Assume the first role found with the name is the correct one.

                // Step 2: Get Users for that Role ID.
                const usersInRoleApiUrl = `${AUTH0_MANAGEMENT_AUDIENCE}roles/${roleId}/users`;
                const usersInRoleResponse = await fetch(usersInRoleApiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                if (!usersInRoleResponse.ok) return sendError(res, usersInRoleResponse.status, `Failed to list users in role '${roleName}' from Auth0`, await usersInRoleResponse.json());
                
                res.status(200).json(await usersInRoleResponse.json()); // Send back the list of users in the role
            } else {
                sendError(res, 400, 'Invalid action for GET request.');
            }
        // --- Handle PUT/PATCH Requests (e.g., update user, assign/unassign roles) ---
        // Note: Auth0 uses PATCH for user updates. PUT for roles is effectively POST/DELETE on a sub-resource.
        } else if (req.method === 'PUT') { // Frontend might send PUT, but actions determine actual Management API method
            // Action: Update a user's attributes
            if (action === 'updateUser') {
                if (!userId) return sendError(res, 400, 'User ID (Auth0 sub) is required for update.');
                if (!updates) return sendError(res, 400, 'Update data is required.');
                // Prepare the payload for updating user attributes. Only include fields to be changed.
                const updatePayload = { ...updates }; // e.g., { given_name: "NewName", app_metadata: { ... } }
                const updateUrl = `${baseUrl}/${encodeURIComponent(userId)}`;
                const reqOptions = {
                    method: 'PATCH', // Use PATCH to update user attributes in Auth0
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatePayload),
                };
                const response = await fetch(updateUrl, reqOptions);
                if (!response.ok) return sendError(res, response.status, 'Failed to update user in Auth0', await response.json());
                res.status(200).json(await response.json()); // Send back the updated user object
            // Action: Assign roles to or Unassign roles from a user
            } else if (action === 'assignRoles' || action === 'unassignRoles') {
                 if (!userId || !roles || !Array.isArray(roles)) return sendError(res, 400, 'User ID and a roles array are required.');

                // This example simplifies role ID lookup: directly handling 'admin' role.
                // A more robust solution would map all role names in `roles` array to their IDs.
                const roleIdsPayload = [];
                if (roles.includes('admin')) { // Check if 'admin' role is being assigned/unassigned
                    const rolesApiUrl = `${AUTH0_MANAGEMENT_AUDIENCE}roles`;
                    const getAdminRoleUrl = `${rolesApiUrl}?name_filter=admin`; // Find the 'admin' role ID
                    const adminRoleResponse = await fetch(getAdminRoleUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (adminRoleResponse.ok) {
                        const adminRolesData = await adminRoleResponse.json();
                        if (adminRolesData && adminRolesData.length > 0) {
                            roleIdsPayload.push(adminRolesData[0].id); // Add admin role ID to payload
                        } else { console.warn("Admin role not found in Auth0 when trying to assign/unassign."); }
                    } else {
                        console.error("Failed to fetch admin role ID from Auth0:", await adminRoleResponse.json());
                    }
                }
                 // If no valid role IDs were found for the given role names (and roles were provided)
                 if (roleIdsPayload.length === 0 && roles.length > 0) {
                     return sendError(res, 400, "Could not map provided role names to Auth0 Role IDs. This example primarily handles 'admin'.");
                 }

                 // URL for Auth0's assign/unassign roles endpoint for a user
                 const userRolesUrl = `${AUTH0_MANAGEMENT_AUDIENCE}users/${encodeURIComponent(userId)}/roles`;
                 // Determine HTTP method based on action: POST to assign, DELETE to unassign
                 const methodForRoles = action === 'assignRoles' ? 'POST' : 'DELETE';
                 const rolesRequestOptions = {
                     method: methodForRoles,
                     headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                     body: JSON.stringify({ roles: roleIdsPayload }) // Payload is an object with a 'roles' array of role IDs
                 };
                 const rolesResponse = await fetch(userRolesUrl, rolesRequestOptions);
                 // Auth0 returns 204 No Content on successful role assignment/unassignment
                 if (!rolesResponse.ok) return sendError(res, rolesResponse.status, `Failed to ${action} in Auth0`, await rolesResponse.json());
                 res.status(204).send(); // Success, no content to return
            } else {
                sendError(res, 400, 'Invalid action for PUT request.');
            }
        // --- Handle DELETE Requests (e.g., delete user) ---
        } else if (req.method === 'DELETE') {
            // Action: Delete a user
            if (action === 'deleteUser') {
                if (!userId) return sendError(res, 400, 'User ID (Auth0 sub) is required for deletion.');
                const deleteUrl = `${baseUrl}/${encodeURIComponent(userId)}`; // URL to delete a specific user
                const response = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                // Auth0 returns 204 No Content on successful deletion
                if (!response.ok) return sendError(res, response.status, 'Failed to delete user in Auth0', await response.json());
                res.status(204).send(); // Success, no content to return
            } else {
                sendError(res, 400, 'Invalid action for DELETE request.');
            }
        } else {
            // If the HTTP method is not one of the handled ones (POST, GET, PUT, DELETE)
            res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']); // Indicate allowed methods
            sendError(res, 405, `Method ${req.method} Not Allowed`);
        }
    } catch (error) {
        // Catch-all for errors during the process (e.g., failure to get M2M token, unexpected issues)
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