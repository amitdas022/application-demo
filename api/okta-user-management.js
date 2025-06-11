// api/okta-user-management.js
// Provides API endpoints for managing Okta users and their group memberships (roles).
// It uses an Okta API token for authentication.

// Load environment variables from .env file in development environments
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config(); // dotenv loads variables from .env into process.env
}
import fetch from 'node-fetch'; // Used for making HTTP requests to the Okta API.

// Okta Configuration from environment variables
const OKTA_DOMAIN = process.env.AUTH0_DOMAIN; // Re-using AUTH0_DOMAIN as it holds the Okta domain
const OKTA_API_TOKEN = process.env.OKTA_API_TOKEN; // Okta API Token (SSWS token)
const BASE_OKTA_API_URL = `https://${OKTA_DOMAIN}/api/v1`; // Base URL for Okta API

/**
 * Helper function to send standardized error responses.
 * @param {object} res - The Express response object.
 * @param {number} statusCode - The HTTP status code to send.
 * @param {string} message - A human-readable error message.
 * @param {object|string} [errorDetails] - Optional additional details about the error.
 */
function sendError(res, statusCode, message, errorDetails) {
    console.error("[Okta Management API Error]", message, errorDetails);
    res.status(statusCode).json({ error: message, details: errorDetails?.message || errorDetails });
}

/**
 * Helper function to make requests to the Okta API.
 * @param {string} endpoint - The API endpoint (e.g., '/users', '/groups').
 * @param {string} [method='GET'] - HTTP method.
 * @param {object} [body=null] - Request body for POST, PUT, etc.
 * @returns {Promise<object>} A promise that resolves to the JSON response from Okta.
 * @throws {Error} If the API request fails or returns an error.
 */
async function fetchOktaAPI(endpoint, method = 'GET', body = null) {
    const url = `${BASE_OKTA_API_URL}${endpoint}`;
    const headers = {
        'Authorization': `SSWS ${OKTA_API_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    const options = { method, headers };
    if (body) {
        options.body = JSON.stringify(body);
    }

    console.log(`[Okta API] Request: ${method} ${url}`, body ? `Body: ${JSON.stringify(body)}` : '');

    try {
        const response = await fetch(url, options);
        const responseBodyForLogging = await response.clone().text(); // Read as text first to handle empty or non-JSON responses
        console.log(`[Okta API] Response: ${response.status} ${response.statusText}`, responseBodyForLogging);

        if (!response.ok) {
            let errorDetails = responseBodyForLogging;
            try {
                errorDetails = JSON.parse(responseBodyForLogging); // Try to parse as JSON if possible
            } catch (e) {
                // Keep as text if not JSON
            }
            // Okta often includes error details in a structured format (e.g., errorSummary, errorCauses)
            const errorMessage = errorDetails.errorSummary || response.statusText;
            throw new Error(`Okta API Error (${response.status}): ${errorMessage}`);
        }

        // For 204 No Content, response.json() will fail.
        if (response.status === 204) {
            return null; // Or an empty object/specific indicator
        }
        return JSON.parse(responseBodyForLogging); // Parse and return JSON for other successful responses
    } catch (error) {
        console.error(`[Okta API] Fetch error for ${method} ${url}:`, error);
        throw error; // Re-throw to be caught by the main handler or specific function
    }
}

/**
 * Helper function to find an Okta group ID by its name.
 * @param {string} groupName - The name of the group to find.
 * @returns {Promise<string|null>} The group ID if found, otherwise null.
 */
async function getGroupIdByName(groupName) {
    if (!groupName) {
        console.warn('[Okta Management API] getGroupIdByName called with no groupName.');
        return null;
    }
    try {
        // Okta API: GET /api/v1/groups?q=${groupName}
        // This searches for groups matching the name.
        const groups = await fetchOktaAPI(`/groups?q=${encodeURIComponent(groupName)}`);
        if (groups && groups.length > 0) {
            // Assuming the first exact match is the desired one.
            // Okta's q search can be broad, so an exact match check is good.
            const foundGroup = groups.find(group => group.profile.name === groupName);
            if (foundGroup) {
                console.log(`[Okta Management API] Group '${groupName}' found with ID: ${foundGroup.id}`);
                return foundGroup.id;
            }
        }
        console.log(`[Okta Management API] Group '${groupName}' not found.`);
        return null;
    } catch (error) {
        console.error(`[Okta Management API] Error finding group ID for '${groupName}':`, error);
        return null; // Return null on error to prevent cascading failures
    }
}


/**
 * Main request handler for the /api/okta-user-management endpoint.
 * Routes requests based on HTTP method and an 'action' parameter to perform various user management tasks.
 * @param {object} req - The Express request object. Expected to contain `action` and relevant data in `body` or `query`.
 * @param {object} res - The Express response object.
 */
export default async function handler(req, res) {
    // Extract action and parameters from request body (for POST, PUT, DELETE) or query string (for GET)
    let action, userId, userData, updates, roles;
    let queryAction, queryUserId, queryRoleName; // Added queryRoleName for GET listUsersInRole

    console.log(`[Okta Management API Handler] Received request: ${req.method} ${req.url}`);
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      ({ action, userId, userData, updates, roles } = req.body);
      console.log(`[Okta Management API Handler] Action: ${action}, Body:`, req.body);
    } else if (req.method === 'GET') {
      queryAction = req.query.action;
      queryUserId = req.query.userId;
      queryRoleName = req.query.roleName; // For listUsersInRole
      console.log(`[Okta Management API Handler] Action: ${queryAction}, Query:`, req.query);
    }

    // Validate that OKTA_API_TOKEN is configured
    if (!OKTA_API_TOKEN) {
        return sendError(res, 500, 'Server configuration error: Okta API token is missing.');
    }
    if (!OKTA_DOMAIN) {
        return sendError(res, 500, 'Server configuration error: Okta domain is missing.');
    }

    try {
        // --- Handle POST Requests (e.g., create user) ---
        if (req.method === 'POST') {
            if (action === 'createUser') {
                if (!userData || !userData.email || !userData.password || !userData.firstName || !userData.lastName) {
                    return sendError(res, 400, 'Missing required fields for user creation (firstName, lastName, email, password).');
                }
                const oktaUserPayload = {
                    profile: {
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        email: userData.email,
                        login: userData.email // Login is typically the email
                    },
                    credentials: {
                        password: { value: userData.password }
                    }
                };
                // '?activate=true' will activate the user immediately
                const newUser = await fetchOktaAPI('/users?activate=true', 'POST', oktaUserPayload);
                // Adapt response if necessary
                const adaptedNewUser = {
                    id: newUser.id,
                    user_id: newUser.id,
                    email: newUser.profile.email,
                    // Include other fields as expected by frontend
                };
                return res.status(201).json(adaptedNewUser);
            } else {
                sendError(res, 400, 'Invalid action for POST request.');
            }
        // --- Handle GET Requests (e.g., list users, get user) ---
        } else if (req.method === 'GET') {
            if (queryAction === 'listUsers') {
                const users = await fetchOktaAPI('/users');
                // Adapt Okta's user list format if needed for frontend compatibility.
                // For now, assume direct pass-through is acceptable or will be handled by frontend.
                // Okta user objects have `id` (for userId), `profile` (for firstName, lastName, email).
                // Frontend expects: user_id or id, given_name, family_name, email.
                const adaptedUsers = users.map(user => ({
                    id: user.id, // Okta user ID
                    user_id: user.id, // For compatibility if frontend uses user_id
                    given_name: user.profile.firstName,
                    family_name: user.profile.lastName,
                    email: user.profile.email,
                    // Add other fields as needed by the frontend if available
                }));
                return res.status(200).json(adaptedUsers);
            } else if (queryAction === 'getUser') {
                if (!queryUserId) {
                    return sendError(res, 400, 'User ID is required for getUser.');
                }
                const user = await fetchOktaAPI(`/users/${encodeURIComponent(queryUserId)}`);
                // Adapt user object if necessary
                const adaptedUser = {
                    id: user.id,
                    user_id: user.id,
                    given_name: user.profile.firstName,
                    family_name: user.profile.lastName,
                    email: user.profile.email,
                    // include other details if the frontend expects them
                };
                return res.status(200).json(adaptedUser);
            } else if (queryAction === 'listUsersInRole') {
                if (!queryRoleName) { // roleName from frontend maps to groupName in Okta
                    return sendError(res, 400, 'Role name (groupName) is required for listUsersInRole.');
                }
                const groupId = await getGroupIdByName(queryRoleName);
                if (!groupId) {
                    return sendError(res, 404, `Group (role) '${queryRoleName}' not found.`);
                }
                const usersInGroup = await fetchOktaAPI(`/groups/${groupId}/users`);
                // Adapt users if needed, similar to listUsers
                const adaptedUsers = usersInGroup.map(user => ({
                    id: user.id,
                    user_id: user.id,
                    // Okta's /groups/{groupId}/users endpoint returns a more limited user profile by default.
                    // It usually includes id, status, created, activated, statusChanged, lastLogin, lastUpdated, passwordChanged, type, profile (with login, email, secondEmail, firstName, lastName, mobilePhone), credentials.
                    // So, we can get names and email directly.
                    name: `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() || user.profile.email, // Construct name
                    email: user.profile.email,
                    // Add other fields if the frontend expects them and they are available
                }));
                return res.status(200).json(adaptedUsers);
            } else {
                sendError(res, 400, 'Invalid action for GET request.');
            }
        // --- Handle PUT Requests (e.g., update user, assign/unassign roles) ---
        } else if (req.method === 'PUT') {
            if (action === 'updateUser') {
                if (!userId) {
                    return sendError(res, 400, 'User ID is required for update.');
                }
                if (!updates) {
                    return sendError(res, 400, 'Update data is required.');
                }
                // Okta uses POST for partial updates. The frontend sends PUT, so we map it.
                // Construct payload based on what frontend sends in `updates`
                // Frontend sends: { given_name: ..., family_name: ... }
                const oktaUpdatePayload = {
                    profile: {}
                };
                if (updates.given_name) oktaUpdatePayload.profile.firstName = updates.given_name;
                if (updates.family_name) oktaUpdatePayload.profile.lastName = updates.family_name;
                // Add other mappable fields if necessary

                if (Object.keys(oktaUpdatePayload.profile).length === 0) {
                    return sendError(res, 400, 'No valid fields to update provided.');
                }

                const updatedUser = await fetchOktaAPI(`/users/${encodeURIComponent(userId)}`, 'POST', oktaUpdatePayload);
                // Adapt response if necessary
                const adaptedUpdatedUser = {
                    id: updatedUser.id,
                    user_id: updatedUser.id,
                    given_name: updatedUser.profile.firstName,
                    family_name: updatedUser.profile.lastName,
                    email: updatedUser.profile.email,
                };
                return res.status(200).json(adaptedUpdatedUser);
            } else if (action === 'assignRoles') {
                if (!userId || !roles || !Array.isArray(roles) || roles.length === 0) {
                    return sendError(res, 400, 'User ID and a non-empty roles array are required for assignRoles.');
                }
                // Assuming roles array contains role names, e.g., ['admin']
                // For simplicity, this example handles one role; extend if multiple roles need to be assigned in one call.
                const roleName = roles[0]; // Frontend currently sends one role, e.g., 'admin'
                const groupId = await getGroupIdByName(roleName);

                if (!groupId) {
                    return sendError(res, 404, `Group (role) '${roleName}' not found. Cannot assign role.`);
                }

                // Add user to group: PUT /api/v1/groups/{groupId}/users/{userId}
                // This endpoint doesn't require a request body. A 204 No Content response indicates success.
                await fetchOktaAPI(`/groups/${groupId}/users/${encodeURIComponent(userId)}`, 'PUT');
                console.log(`[Okta Management API] User ${userId} assigned to group ${groupId} (role '${roleName}').`);
                return res.status(204).send(); // Success, no content
            } else if (action === 'unassignRoles') {
                if (!userId || !roles || !Array.isArray(roles) || roles.length === 0) {
                    return sendError(res, 400, 'User ID and a non-empty roles array are required for unassignRoles.');
                }
                const roleName = roles[0]; // Assuming one role as per current frontend
                const groupId = await getGroupIdByName(roleName);

                if (!groupId) {
                    return sendError(res, 404, `Group (role) '${roleName}' not found. Cannot unassign role.`);
                }

                // Remove user from group: DELETE /api/v1/groups/{groupId}/users/{userId}
                // A 204 No Content response indicates success.
                await fetchOktaAPI(`/groups/${groupId}/users/${encodeURIComponent(userId)}`, 'DELETE');
                console.log(`[Okta Management API] User ${userId} unassigned from group ${groupId} (role '${roleName}').`);
                return res.status(204).send(); // Success, no content
            } else {
                sendError(res, 400, 'Invalid action for PUT request.');
            }
        // --- Handle DELETE Requests (e.g., delete user) ---
        // Note: unassignRoles is handled under PUT for logical grouping with assignRoles,
        // even though the Okta API uses DELETE for group membership removal.
        // If frontend were to send DELETE for unassignRoles, it could be routed here.
        } else if (req.method === 'DELETE') {
            if (action === 'deleteUser') {
                if (!userId) {
                    return sendError(res, 400, 'User ID is required for deletion.');
                }
                // Step 1: Deactivate User
                // Okta requires deactivation before deletion for users not in 'NEW' status.
                // We'll attempt deactivation first. If it fails because user is already deactivated, that's fine.
                try {
                    await fetchOktaAPI(`/users/${encodeURIComponent(userId)}/lifecycle/deactivate`, 'POST');
                    console.log(`[Okta Management API] User ${userId} deactivated.`);
                } catch (deactivateError) {
                    // Check if error is because user is already deactivated (Okta might return 400 or 401 for this)
                    // or if user not found (404). If it's a significant error, rethrow.
                    // For this example, we'll log and proceed to delete, as delete handles 'user not found'.
                    console.warn(`[Okta Management API] Deactivating user ${userId} encountered an issue (might be already deactivated or not found):`, deactivateError.message);
                }

                // Step 2: Delete User
                await fetchOktaAPI(`/users/${encodeURIComponent(userId)}`, 'DELETE');
                console.log(`[Okta Management API] User ${userId} deleted.`);
                return res.status(204).send(); // Success, no content
            } else {
                sendError(res, 400, 'Invalid action for DELETE request.');
            }
        } else {
            res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
            sendError(res, 405, `Method ${req.method} Not Allowed`);
        }
    } catch (error) {
        sendError(res, error.statusCode || 500, 'Okta Management API operation failed.', error.message || error);
    }
}

// Vercel specific configuration: enables Next.js API routes to parse the request body.
// Without this, `req.body` would be undefined for POST/PUT requests.
export const config = {
    api: {
        bodyParser: true, // Enable body parsing for this API route
    },
};