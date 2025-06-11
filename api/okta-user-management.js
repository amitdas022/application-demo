// api/okta-user-management.js
// Provides API endpoints for managing Okta users and their group memberships (roles).
// Now includes robust server-side authorization by fetching user info (including groups)
// via the /userinfo endpoint using the end-user's access token.

// Load environment variables from .env file in development environments
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
import fetch from 'node-fetch';

// Okta Configuration from environment variables
const OKTA_DOMAIN = process.env.AUTH0_DOMAIN; // Re-using AUTH0_DOMAIN as it holds the Okta domain
const OKTA_API_TOKEN = process.env.OKTA_API_TOKEN; // Using static SSWS token for Management API

const BASE_OKTA_API_URL = `https://${OKTA_DOMAIN}/api/v1`; // Base URL for Okta API
const OKTA_ISSUER = `https://${OKTA_DOMAIN}/oauth2/default`; // Issuer for user tokens (for userinfo endpoint)

/**
 * Helper function to send standardized error responses.
 * @param {object} res - The Express response object.
 * @param {number} statusCode - The HTTP status code to send.
 * @param {string} message - A human-readable error message.
 * @param {object|string} [errorDetails] - Optional additional details about the error.
 */
function sendError(res, statusCode, message, errorDetails) {
    console.error("[Okta Management API Error]", message, errorDetails?.message || errorDetails);
    res.status(statusCode).json({ error: message, details: errorDetails?.message || errorDetails });
}

/**
 * Helper function to make requests to the Okta Management API (using SSWS token).
 * @param {string} endpoint - The API endpoint (e.g., '/users', '/groups').
 * @param {string} [method='GET'] - HTTP method.
 * @param {object} [body=null] - Request body for POST, PUT, etc.
 * @returns {Promise<object>} A promise that resolves to the JSON response from Okta.
 * @throws {Error} If the API request fails or returns an error.
 */
async function fetchOktaAPI(endpoint, method = 'GET', body = null) {
    const url = `${BASE_OKTA_API_URL}${endpoint}`;

    // Validate OKTA_API_TOKEN is present before making the call
    if (!OKTA_API_TOKEN) {
        throw new Error('Server configuration error: Okta API token (SSWS) is missing. Please set OKTA_API_TOKEN in your environment variables.');
    }

    const headers = {
        'Authorization': `SSWS ${OKTA_API_TOKEN}`, // Use SSWS token
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
        const responseBodyForLogging = await response.clone().text();
        console.log(`[Okta API] Response: ${response.status} ${response.statusText}`, responseBodyForLogging);

        if (!response.ok) {
            let errorDetails = responseBodyForLogging;
            try {
                errorDetails = JSON.parse(responseBodyForLogging);
            } catch (e) {
                // Keep as text if not JSON
            }
            const errorMessage = errorDetails.errorSummary || response.statusText;
            throw new Error(`Okta API Error (${response.status}): ${errorMessage}`);
        }

        if (response.status === 204) {
            return null;
        }
        return JSON.parse(responseBodyForLogging);
    } catch (error) {
        console.error(`[Okta API] Fetch error for ${method} ${url}:`, error);
        throw error;
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
        const groups = await fetchOktaAPI(`/groups?q=${encodeURIComponent(groupName)}`);
        if (groups && groups.length > 0) {
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
        return null;
    }
}


/**
 * Middleware-like function to authenticate and authorize the end-user for admin operations.
 * This function validates the access token provided by the frontend by calling Okta's /userinfo endpoint
 * and checks for the 'Admin' role in the returned claims.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @returns {Promise<object|null>} The userinfo response if authorized, otherwise sends an error response and returns null.
 */
async function authenticateUser(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        sendError(res, 401, 'Unauthorized: Access token missing or malformed.');
        return null;
    }

    const userAccessToken = authHeader.split(' ')[1];

    if (!userAccessToken) {
        sendError(res, 401, 'Unauthorized: Access token is empty.');
        return null;
    }

    try {
        // Call Okta's /userinfo endpoint to validate the token and get user claims.
        // This implicitly checks if the token is valid, active, and for the correct issuer/audience.
        const userinfoUrl = `https://${OKTA_DOMAIN}/oauth2/default/v1/userinfo`;
        console.log(`[AuthZ] Fetching userinfo for authorization from: ${userinfoUrl}`);

        const userinfoResponse = await fetch(userinfoUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${userAccessToken}`,
                'Accept': 'application/json'
            }
        });

        const userinfoData = await userinfoResponse.json();

        // If the /userinfo call fails or returns an error status, the token is invalid or unauthorized.
        if (!userinfoResponse.ok) {
            console.error("[AuthZ] Userinfo fetch failed:", userinfoResponse.status, userinfoData);
            let errorMessage = 'Unauthorized: Failed to validate user token with Okta.';
            if (userinfoResponse.status === 401) {
                errorMessage = 'Unauthorized: Invalid or expired access token.';
            }
            sendError(res, userinfoResponse.status, errorMessage, userinfoData);
            return null;
        }

        // Check for 'groups' claim and 'Admin' role in the userinfo response
        const userRoles = userinfoData.groups || [];
        console.log('USERROLES:', userRoles);
        if (!Array.isArray(userRoles) || !userRoles.some(role => role.toLowerCase() === 'admin')) {
            sendError(res, 403, 'Forbidden: User does not have administrative privileges.');
            return null;
        }

        console.log("[AuthZ] User authenticated and authorized via userinfo:", userinfoData.sub, "Roles:", userRoles);
        return userinfoData; // Return the userinfo data (including sub, email, groups etc.)

    } catch (error) {
        console.error("[AuthZ] Error during userinfo validation:", error);
        sendError(res, 500, 'Internal server error during user authorization.', error.message);
        return null;
    }
}


/**
 * Main request handler for the /api/okta-user-management endpoint.
 * Routes requests based on HTTP method and an 'action' parameter to perform various user management tasks.
 * Includes robust server-side authorization check using /userinfo.
 * @param {object} req - The Express request object. Expected to contain `action` and relevant data in `body` or `query`.
 * @param {object} res - The Express response object.
 */
export default async function handler(req, res) {
    let action, userId, userData, updates, roles;
    let queryAction, queryUserId, queryRoleName;

    console.log(`[Okta Management API Handler] Received request: ${req.method} ${req.url}`);
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      ({ action, userId, userData, updates, roles } = req.body);
      console.log(`[Okta Management API Handler] Action: ${action}, Body:`, req.body);
    } else if (req.method === 'GET') {
      queryAction = req.query.action;
      queryUserId = req.query.userId;
      queryRoleName = req.query.roleName;
      console.log(`[Okta Management API Handler] Action: ${queryAction}, Query:`, req.query);
    }

    // --- Server-side authorization check ---
    // This call will send an error response (401 or 403) and return null if not authorized.
    const authorizedUser = await authenticateUser(req, res);
    if (!authorizedUser) {
        return; // authenticateUser already handled sending the error response
    }
    // At this point, 'authorizedUser' contains the validated user's claims, and the user is confirmed to be an 'Admin'.

    // Validate that OKTA_API_TOKEN is configured (needed for fetchOktaAPI)
    if (!OKTA_API_TOKEN) {
        return sendError(res, 500, 'Server configuration error: Okta API token (SSWS) is missing. Cannot perform management operations.');
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
                        login: userData.email
                    },
                    credentials: {
                        password: { value: userData.password }
                    }
                };
                const newUser = await fetchOktaAPI('/users?activate=true', 'POST', oktaUserPayload);
                const adaptedNewUser = {
                    id: newUser.id,
                    user_id: newUser.id,
                    email: newUser.profile.email,
                };
                return res.status(201).json(adaptedNewUser);
            } else {
                sendError(res, 400, 'Invalid action for POST request.');
            }
        } else if (req.method === 'GET') {
            if (queryAction === 'listUsers') {
                const users = await fetchOktaAPI('/users');
                const adaptedUsers = users.map(user => ({
                    id: user.id,
                    user_id: user.id,
                    given_name: user.profile.firstName,
                    family_name: user.profile.lastName,
                    email: user.profile.email,
                }));
                return res.status(200).json(adaptedUsers);
            } else if (queryAction === 'getUser') {
                if (!queryUserId) {
                    return sendError(res, 400, 'User ID is required for getUser.');
                }
                const user = await fetchOktaAPI(`/users/${encodeURIComponent(queryUserId)}`);
                const adaptedUser = {
                    id: user.id,
                    user_id: user.id,
                    given_name: user.profile.firstName,
                    family_name: user.profile.lastName,
                    email: user.profile.email,
                };
                return res.status(200).json(adaptedUser);
            } else if (queryAction === 'listUsersInRole') {
                if (!queryRoleName) {
                    return sendError(res, 400, 'Role name (groupName) is required for listUsersInRole.');
                }
                const groupId = await getGroupIdByName(queryRoleName);
                if (!groupId) {
                    return sendError(res, 404, `Group (role) '${queryRoleName}' not found.`);
                }
                const usersInGroup = await fetchOktaAPI(`/groups/${groupId}/users`);
                const adaptedUsers = usersInGroup.map(user => ({
                    id: user.id,
                    user_id: user.id,
                    name: `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim() || user.profile.email,
                    email: user.profile.email,
                }));
                return res.status(200).json(adaptedUsers);
            } else {
                sendError(res, 400, 'Invalid action for GET request.');
            }
        } else if (req.method === 'PUT') {
            if (action === 'updateUser') {
                if (!userId) {
                    return sendError(res, 400, 'User ID is required for update.');
                }
                if (!updates) {
                    return sendError(res, 400, 'Update data is required.');
                }
                const oktaUpdatePayload = {
                    profile: {}
                };
                if (updates.given_name) oktaUpdatePayload.profile.firstName = updates.given_name;
                if (updates.family_name) oktaUpdatePayload.profile.lastName = updates.family_name;

                if (Object.keys(oktaUpdatePayload.profile).length === 0) {
                    return sendError(res, 400, 'No valid fields to update provided.');
                }

                const updatedUser = await fetchOktaAPI(`/users/${encodeURIComponent(userId)}`, 'POST', oktaUpdatePayload);
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
                const roleName = roles[0];
                const groupId = await getGroupIdByName(roleName);

                if (!groupId) {
                    return sendError(res, 404, `Group (role) '${roleName}' not found.`);
                }

                await fetchOktaAPI(`/groups/${groupId}/users/${encodeURIComponent(userId)}`, 'PUT');
                console.log(`[Okta Management API] User ${userId} assigned to group ${groupId} (role '${roleName}').`);
                return res.status(204).send();
            } else if (action === 'unassignRoles') {
                if (!userId || !roles || !Array.isArray(roles) || roles.length === 0) {
                    return sendError(res, 400, 'User ID and a non-empty roles array are required for unassignRoles.');
                }
                const roleName = roles[0];
                const groupId = await getGroupIdByName(roleName);

                if (!groupId) {
                    return sendError(res, 404, `Group (role) '${roleName}' not found.`);
                }

                await fetchOktaAPI(`/groups/${groupId}/users/${encodeURIComponent(userId)}`, 'DELETE');
                console.log(`[Okta Management API] User ${userId} unassigned from group ${groupId} (role '${roleName}').`);
                return res.status(204).send();
            } else {
                sendError(res, 400, 'Invalid action for PUT request.');
            }
        } else if (req.method === 'DELETE') {
            if (action === 'deleteUser') {
                if (!userId) {
                    return sendError(res, 400, 'User ID is required for deletion.');
                }
                try {
                    await fetchOktaAPI(`/users/${encodeURIComponent(userId)}/lifecycle/deactivate`, 'POST');
                    console.log(`[Okta Management API] User ${userId} deactivated.`);
                } catch (deactivateError) {
                    console.warn(`[Okta Management API] Deactivating user ${userId} encountered an issue (might be already deactivated or not found):`, deactivateError.message);
                }

                await fetchOktaAPI(`/users/${encodeURIComponent(userId)}`, 'DELETE');
                console.log(`[Okta Management API] User ${userId} deleted.`);
                return res.status(204).send();
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