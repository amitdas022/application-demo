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
    console.error("[Auth0 Management API Error]", message, errorDetails); // Ensure this format is good.
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
            client_id: AUTH0_M2M_CLIENT_ID,       // Client ID of your M2M application
            // client_secret: AUTH0_M2M_CLIENT_SECRET, // Client Secret should not be logged
            audience: AUTH0_MANAGEMENT_AUDIENCE,  // Audience identifier for the Auth0 Management API
            grant_type: 'client_credentials',   // Specifies the M2M grant type
        };
        const tokenRequestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: tokenRequestPayload.client_id, // Log only client_id
                audience: tokenRequestPayload.audience,
                grant_type: tokenRequestPayload.grant_type,
            }),
        };
        console.log(`[Auth0 Management API] Requesting M2M token. URL: ${tokenUrl}, Payload:`, { client_id: AUTH0_M2M_CLIENT_ID, audience: AUTH0_MANAGEMENT_AUDIENCE, grant_type: 'client_credentials' }); // Log payload without secret

        // Fetch the M2M token from Auth0
        const response = await fetch(tokenUrl, { // Use actual payload with secret for the fetch
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: AUTH0_M2M_CLIENT_ID,
                client_secret: AUTH0_M2M_CLIENT_SECRET,
                audience: AUTH0_MANAGEMENT_AUDIENCE,
                grant_type: 'client_credentials',
            }),
        });

        const responseBodyForLogging = await response.clone().json().catch(() => response.text());
        console.log(`[Auth0 Management API] M2M token response. Status: ${response.status}, Body:`, responseBodyForLogging);

        if (!response.ok) {
            // console.error already called by sendError or generic catch, specific log here for token failure context
            console.error('Failed to get Auth0 Management API token detailed body:', responseBodyForLogging);
            throw new Error(`Auth0 Token Error: ${responseBodyForLogging.error_description || response.statusText}`);
        }

        // Parse the successful token response
        const data = await response.json(); // Use original response
        managementApiToken = data.access_token; // Cache the new token
        console.log('[Auth0 Management API] M2M token acquired successfully.');
        // Calculate expiry: current time + (token lifetime in seconds - 5 minutes buffer) * 1000 ms
        tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
        return managementApiToken;
    } catch (error) {
        console.error('[Auth0 Management API] Error fetching Auth0 Management API token:', error);
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
    let action, userId, userData, updates, roles;
    let queryAction, queryUserId;

    console.log(`[Auth0 Management API Handler] Received request: ${req.method} ${req.url}`);
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      ({ action, userId, userData, updates, roles } = req.body);
      console.log(`[Auth0 Management API Handler] Action: ${action}, Body:`, req.body);
    } else if (req.method === 'GET') {
      queryAction = req.query.action;
      queryUserId = req.query.userId;
      console.log(`[Auth0 Management API Handler] Action: ${queryAction}, Query:`, req.query);
    }

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
                console.log(`[Auth0 Management API] Creating user. URL: ${baseUrl}, Payload:`, createUserData);
                const response = await fetch(baseUrl, reqOptions);
                // After fetch:
                const responseBody = await response.clone().json().catch(() => response.text()); // Clone to read body safely
                console.log(`[Auth0 Management API] Create user response. Status: ${response.status}, Body:`, responseBody);
                if (!response.ok) return sendError(res, response.status, 'Failed to create user in Auth0', responseBody);
                res.status(201).json(await response.json()); // Original response.json() call
            } else {
                sendError(res, 400, 'Invalid action for POST request.');
            }
        // --- Handle GET Requests (e.g., list users, get user) ---
        } else if (req.method === 'GET') {
            // Action: List all users
            if (queryAction === 'listUsers') {
                console.log(`[Auth0 Management API] Listing users. URL: ${baseUrl}`);
                const response = await fetch(baseUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                const responseBody = await response.clone().json().catch(() => response.text());
                console.log(`[Auth0 Management API] List users response. Status: ${response.status}, Body:`, responseBody);
                if (!response.ok) return sendError(res, response.status, 'Failed to list users from Auth0', responseBody);
                res.status(200).json(await response.json());
            // Action: Get a specific user by ID
            } else if (queryAction === 'getUser') {
                if (!queryUserId) return sendError(res, 400, 'User ID (Auth0 sub) is required for getUser.');
                const getUserUrl = `${baseUrl}/${encodeURIComponent(queryUserId)}`; // URL for specific user
                console.log(`[Auth0 Management API] Getting user. URL: ${getUserUrl}`);
                const response = await fetch(getUserUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                const responseBody = await response.clone().json().catch(() => response.text());
                console.log(`[Auth0 Management API] Get user response. Status: ${response.status}, Body:`, responseBody);
                if (!response.ok) return sendError(res, response.status, 'Failed to get user from Auth0', responseBody);
                res.status(200).json(await response.json());
            // Action: List users assigned to a specific role
            } else if (queryAction === 'listUsersInRole') {
                const roleName = req.query.roleName; // Role name passed as a query parameter
                if (!roleName) return sendError(res, 400, 'roleName query parameter is required for listUsersInRole.');

                // Step 1: Get Role ID from Role Name.
                // Auth0 Management API requires Role ID to list users in a role.
                const rolesApiUrl = `${AUTH0_MANAGEMENT_AUDIENCE}roles`;
                const getRoleUrl = `${rolesApiUrl}?name_filter=${encodeURIComponent(roleName)}`;
                console.log(`[Auth0 Management API] Getting role ID for role name '${roleName}'. URL: ${getRoleUrl}`);
                const rolesResponse = await fetch(getRoleUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                const rolesResponseBody = await rolesResponse.clone().json().catch(() => rolesResponse.text());
                console.log(`[Auth0 Management API] Get role ID response. Status: ${rolesResponse.status}, Body:`, rolesResponseBody);
                if (!rolesResponse.ok) return sendError(res, rolesResponse.status, `Failed to find role '${roleName}' in Auth0`, rolesResponseBody);
                
                const rolesData = await rolesResponse.json(); // Use original response
                if (!rolesData || rolesData.length === 0) return sendError(res, 404, `Role '${roleName}' not found in Auth0.`);
                const roleId = rolesData[0].id; // Assume the first role found with the name is the correct one.
                console.log(`[Auth0 Management API] Role ID for '${roleName}' is '${roleId}'.`);

                // Step 2: Get Users for that Role ID.
                const usersInRoleApiUrl = `${AUTH0_MANAGEMENT_AUDIENCE}roles/${roleId}/users`;
                console.log(`[Auth0 Management API] Listing users in role '${roleName}' (ID: '${roleId}'). URL: ${usersInRoleApiUrl}`);
                const usersInRoleResponse = await fetch(usersInRoleApiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                const usersInRoleResponseBody = await usersInRoleResponse.clone().json().catch(() => usersInRoleResponse.text());
                console.log(`[Auth0 Management API] List users in role response. Status: ${usersInRoleResponse.status}, Body:`, usersInRoleResponseBody);
                if (!usersInRoleResponse.ok) return sendError(res, usersInRoleResponse.status, `Failed to list users in role '${roleName}' from Auth0`, usersInRoleResponseBody);
                
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
                console.log(`[Auth0 Management API] Updating user. URL: ${updateUrl}, Payload:`, updatePayload);
                const response = await fetch(updateUrl, reqOptions);
                const responseBody = await response.clone().json().catch(() => response.text());
                console.log(`[Auth0 Management API] Update user response. Status: ${response.status}, Body:`, responseBody);
                if (!response.ok) return sendError(res, response.status, 'Failed to update user in Auth0', responseBody);
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
                    console.log(`[Auth0 Management API] Looking up 'admin' role ID. URL: ${getAdminRoleUrl}`);
                    const adminRoleResponse = await fetch(getAdminRoleUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                    const adminRoleResponseBody = await adminRoleResponse.clone().json().catch(() => adminRoleResponse.text());
                    console.log(`[Auth0 Management API] 'admin' role ID lookup response. Status: ${adminRoleResponse.status}, Body:`, adminRoleResponseBody);

                    if (adminRoleResponse.ok) {
                        const adminRolesData = await adminRoleResponse.json(); // Use original response
                        if (adminRolesData && adminRolesData.length > 0) {
                            roleIdsPayload.push(adminRolesData[0].id); // Add admin role ID to payload
                            console.log(`[Auth0 Management API] 'admin' role ID found: ${adminRolesData[0].id}`);
                        } else {
                            console.warn("[Auth0 Management API] Admin role not found in Auth0 when trying to assign/unassign.");
                        }
                    } else {
                        // Error already logged with body by the general log above
                        console.error("[Auth0 Management API] Failed to fetch admin role ID from Auth0.");
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
                 const rolesPayload = { roles: roleIdsPayload };
                 const rolesRequestOptions = {
                     method: methodForRoles,
                     headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                     body: JSON.stringify(rolesPayload) // Payload is an object with a 'roles' array of role IDs
                 };
                 console.log(`[Auth0 Management API] ${action} for user ${userId}. URL: ${userRolesUrl}, Method: ${methodForRoles}, Payload:`, rolesPayload);
                 const rolesResponse = await fetch(userRolesUrl, rolesRequestOptions);
                 const rolesResponseBody = await rolesResponse.clone().text(); // Use text() for 204 or error
                 console.log(`[Auth0 Management API] ${action} response. Status: ${rolesResponse.status}, Body:`, rolesResponseBody);
                 // Auth0 returns 204 No Content on successful role assignment/unassignment
                 if (!rolesResponse.ok) return sendError(res, rolesResponse.status, `Failed to ${action} in Auth0`, rolesResponseBody);
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
                console.log(`[Auth0 Management API] Deleting user. URL: ${deleteUrl}`);
                const response = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const responseBody = await response.clone().text(); // Use text() for 204 or error
                console.log(`[Auth0 Management API] Delete user response. Status: ${response.status}, Body:`, responseBody);
                // Auth0 returns 204 No Content on successful deletion
                if (!response.ok) return sendError(res, response.status, 'Failed to delete user in Auth0', responseBody);
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