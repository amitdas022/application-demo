// api/okta-user-management.js
// Provides API endpoints for managing Okta users and their group memberships (roles).
// Now includes robust server-side authorization by fetching user info (including groups)
// via the /userinfo endpoint using the end-user's access token.
// IMPORTANT: Management API calls now use OAuth 2.0 Client Credentials Grant (M2M) flow
// with private_key_jwt client authentication.
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken'; // Import jsonwebtoken for JWT creation
import crypto from 'crypto'; // For generating JTI

// Okta Configuration from environment variables
const OKTA_DOMAIN = process.env.AUTH0_DOMAIN; // Re-using AUTH0_DOMAIN as it holds the Okta domain
// M2M Client Credentials (Client ID only, secret is replaced by private_key_jwt)
const OKTA_M2M_CLIENT_ID = process.env.OKTA_M2M_CLIENT_ID;

const BASE_OKTA_API_URL = `https://${OKTA_DOMAIN}/api/v1`; // Base URL for Okta API
const OKTA_ISSUER = `https://${OKTA_DOMAIN}/oauth2/default`; // Issuer for user tokens (for userinfo endpoint)

// Define your default group name here.
// Ensure this group exists in Okta and is assigned to your application.
const DEFAULT_ACCESS_GROUP_NAME = "AccessBoardUsers";

// Cache for M2M Access Token
let m2mAccessToken = null;
let m2mTokenExpiry = 0; // Unix timestamp in seconds

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
 * Fetches an M2M access token from Okta using the Client Credentials Grant flow
 * with private_key_jwt client authentication. Caches the token and refreshes it when expired.
 * @returns {Promise<string>} A promise that resolves to the M2M access token.
 * @throws {Error} If the token exchange fails or key is missing.
 */
async function getM2MAccessToken() {
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds

    // Return cached token if not expired
    if (m2mAccessToken && m2mTokenExpiry > currentTime + 30) { // Refresh 30 seconds before actual expiry
        console.log("[M2M Auth] Using cached M2M access token.");
        return m2mAccessToken;
    }

    console.log("[M2M Auth] Fetching new M2M access token using private_key_jwt...");

    if (!OKTA_M2M_CLIENT_ID) {
        throw new Error('Server configuration error: Okta M2M Client ID is missing.');
    }

    // --- CORRECTED SECTION STARTS HERE ---
    let privateKeyBase64 = process.env.OKTA_M2M_PRIVATE_KEY; // Declare and assign it here first

    if (!privateKeyBase64) { // Then you can check its value
        console.error(`[M2M Auth Error] Environment variable OKTA_M2M_PRIVATE_KEY is not set.`);
        throw new Error('Server configuration error: OKTA_M2M_PRIVATE_KEY environment variable is missing.');
    }

    let privateKey;
    try {
        // Decode the base64 string back to the original private key PEM format
        privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
    } catch (err) {
        console.error(`[M2M Auth Error] Failed to decode private key from environment variable:`, err);
        throw new Error('Server configuration error: Private key decoding failed. Check base64 encoding.');
    }
    // --- CORRECTED SECTION ENDS HERE ---

    // --- Create client_assertion JWT ---
    // JWT Header
    const header = {
        alg: 'RS256', // Algorithm used to sign the JWT
        typ: 'JWT',   // Type of the token
    };

    // JWT Claims (Payload)
    // The 'aud' (Audience) must be the token endpoint URL for the Org Authorization Server.
    const claims = {
        iss: OKTA_M2M_CLIENT_ID, // Issuer (your client_id)
        sub: OKTA_M2M_CLIENT_ID, // Subject (your client_id)
        aud: `https://${OKTA_DOMAIN}/oauth2/v1/token`, // Audience (Okta's token endpoint for Org Auth Server)
        exp: currentTime + 300, // Expiration time (e.g., 5 minutes from now)
        iat: currentTime, // Issued at time
        jti: crypto.randomBytes(16).toString('hex'), // Unique JWT ID
    };

    let clientAssertion;
    try {
        clientAssertion = jwt.sign(claims, privateKey, { algorithm: 'RS256', header });
        console.log("[M2M Auth] client_assertion JWT successfully created.");
    } catch (err) {
        console.error("[M2M Auth Error] Failed to sign JWT:", err);
        throw new Error('Failed to create signed JWT client assertion. Check private key format or jwt library usage.');
    }
    // --- End client_assertion JWT creation ---

    // The token endpoint for the Okta Org Authorization Server (without '/default')
    const tokenUrl = `https://${OKTA_DOMAIN}/oauth2/v1/token`;

    const requestBody = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: OKTA_M2M_CLIENT_ID, // Still needs to be sent as part of the request body
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', // Required type
        client_assertion: clientAssertion, // The signed JWT
        scope: 'okta.users.manage okta.groups.manage okta.users.read okta.groups.read' // Scopes for Okta Management API
    }).toString();

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: requestBody,
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error("[M2M Auth Error] Failed to get M2M access token:", response.status, responseData);
            throw new Error(`Okta M2M Token Error (${response.status}): ${responseData.error_description || responseData.error}`);
        }

        m2mAccessToken = responseData.access_token;
        m2mTokenExpiry = currentTime + responseData.expires_in;
        console.log("[M2M Auth] Successfully obtained new M2M access token. Expires in:", responseData.expires_in, "seconds.");
        return m2mAccessToken;

    } catch (error) {
        console.error("[M2M Auth Error] Network or unexpected error during M2M token fetch:", error);
        throw error;
    }
}

/**
 * Helper function to make requests to the Okta Management API (using M2M token).
 * @param {string} endpoint - The API endpoint (e.g., '/users', '/groups').
 * @param {string} [method='GET'] - HTTP method.
 * @param {object} [body=null] - Request body for POST, PUT, etc.
 * @returns {Promise<object>} A promise that resolves to the JSON response from Okta.
 * @throws {Error} If the API request fails or returns an error.
 */
async function fetchOktaAPI(endpoint, method = 'GET', body = null) {
    const url = `${BASE_OKTA_API_URL}${endpoint}`;

    // Get the M2M access token
    const token = await getM2MAccessToken();

    const headers = {
        'Authorization': `Bearer ${token}`, // Use Bearer token for M2M
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

    // Validate that OKTA_M2M_CLIENT_ID is configured (needed for getM2MAccessToken)
    if (!OKTA_M2M_CLIENT_ID) {
        return sendError(res, 500, 'Server configuration error: Okta M2M Client ID is missing. Cannot perform management operations.');
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

                // --- NEW LOGIC: Assign new user to default access group ---
                const defaultGroupId = await getGroupIdByName(DEFAULT_ACCESS_GROUP_NAME);
                if (defaultGroupId) {
                    try {
                        await fetchOktaAPI(`/groups/${defaultGroupId}/users/${encodeURIComponent(newUser.id)}`, 'PUT');
                        console.log(`[Okta Management API] New user ${newUser.id} automatically assigned to group '${DEFAULT_ACCESS_GROUP_NAME}'.`);
                    } catch (groupAssignError) {
                        console.warn(`[Okta Management API] Failed to automatically assign user ${newUser.id} to group '${DEFAULT_ACCESS_GROUP_NAME}':`, groupAssignError.message);
                        // Log but don't block user creation success, as primary goal is user creation.
                    }
                } else {
                    console.warn(`[Okta Management API] Default access group '${DEFAULT_ACCESS_GROUP_NAME}' not found. User was created but not automatically assigned to the application.`);
                }
                // --- END NEW LOGIC ---

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