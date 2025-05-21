// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
import fetch from 'node-fetch';

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_M2M_CLIENT_ID = process.env.AUTH0_M2M_CLIENT_ID;
const AUTH0_M2M_CLIENT_SECRET = process.env.AUTH0_M2M_CLIENT_SECRET;
const AUTH0_MANAGEMENT_AUDIENCE = process.env.AUTH0_MANAGEMENT_AUDIENCE; // e.g., https://your-domain.auth0.com/api/v2/

let managementApiToken = null;
let tokenExpiry = 0;

// Helper to send error responses
function sendError(res, statusCode, message, errorDetails) {
    console.error("Auth0 Management API Error:", message, errorDetails);
    res.status(statusCode).json({ error: message, details: errorDetails?.message || errorDetails });
}

async function getManagementApiToken() {
    if (managementApiToken && Date.now() < tokenExpiry) {
        return managementApiToken;
    }

    const tokenUrl = `https://${AUTH0_DOMAIN}/oauth/token`;
    try {
        const tokenRequest = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: AUTH0_M2M_CLIENT_ID,
                client_secret: AUTH0_M2M_CLIENT_SECRET,
                audience: AUTH0_MANAGEMENT_AUDIENCE,
                grant_type: 'client_credentials',
            }),
        };
        //console.log('[Auth0] Fetching Management Token:', tokenUrl, tokenRequest);

        const response = await fetch(tokenUrl, tokenRequest);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to get Auth0 Management API token:', errorData);
            throw new Error(`Auth0 Token Error: ${errorData.error_description || response.statusText}`);
        }
        const data = await response.json();
        managementApiToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in - 300) * 1000; // Refresh 5 mins before expiry
        return managementApiToken;
    } catch (error) {
        console.error('Error fetching Auth0 Management API token:', error);
        throw error; // Re-throw to be caught by the handler
    }
}

export default async function handler(req, res) {
    const { action, userId, userData, updates, roles } = req.body;
    const queryAction = req.query.action;
    const queryUserId = req.query.userId;

    try {
        const token = await getManagementApiToken();
        // Log the incoming request from the frontend first
        const baseUrl = `${AUTH0_MANAGEMENT_AUDIENCE}users`;

        if (req.method === 'POST') {
            if (action === 'createUser') {
                if (!userData || !userData.email || !userData.password) {
                    return sendError(res, 400, 'Email and password are required for user creation.');
                }
                const createUserData = {
                    email: userData.email,
                    password: userData.password,
                    given_name: userData.firstName,
                    family_name: userData.lastName,
                    connection: 'Username-Password-Authentication',
                    email_verified: true,
                };
                const reqOptions = {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(createUserData),
                };
                const response = await fetch(baseUrl, reqOptions);
                if (!response.ok) return sendError(res, response.status, 'Failed to create user in Auth0', await response.json());
                res.status(201).json(await response.json());
            } else {
                sendError(res, 400, 'Invalid action for POST request.');
            }
        } else if (req.method === 'GET') {
            if (queryAction === 'listUsers') {
                const response = await fetch(baseUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                if (!response.ok) return sendError(res, response.status, 'Failed to list users from Auth0', await response.json());
                res.status(200).json(await response.json());
            } else if (queryAction === 'getUser') {
                if (!queryUserId) return sendError(res, 400, 'User ID (Auth0 sub) is required.');
                const getUserUrl = `${baseUrl}/${encodeURIComponent(queryUserId)}`;
                const response = await fetch(getUserUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                if (!response.ok) return sendError(res, response.status, 'Failed to get user from Auth0', await response.json());
                res.status(200).json(await response.json());
            } else if (queryAction === 'listUsersInRole') {
                const roleName = req.query.roleName;
                if (!roleName) return sendError(res, 400, 'roleName query parameter is required for listUsersInRole.');

                // Step 1: Get Role ID from Role Name
                const rolesApiUrl = `${AUTH0_MANAGEMENT_AUDIENCE}roles`;
                const getRoleUrl = `${rolesApiUrl}?name_filter=${encodeURIComponent(roleName)}`;
                const rolesResponse = await fetch(getRoleUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                if (!rolesResponse.ok) return sendError(res, rolesResponse.status, `Failed to find role '${roleName}' in Auth0`, await rolesResponse.json());
                
                const rolesData = await rolesResponse.json();
                if (!rolesData || rolesData.length === 0) return sendError(res, 404, `Role '${roleName}' not found in Auth0.`);
                const roleId = rolesData[0].id; // Assuming the first role found is the correct one

                // Step 2: Get Users for that Role ID
                const usersInRoleApiUrl = `${AUTH0_MANAGEMENT_AUDIENCE}roles/${roleId}/users`;
                const usersInRoleResponse = await fetch(usersInRoleApiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                if (!usersInRoleResponse.ok) return sendError(res, usersInRoleResponse.status, `Failed to list users in role '${roleName}' from Auth0`, await usersInRoleResponse.json());
                
                res.status(200).json(await usersInRoleResponse.json());
            } else {
                sendError(res, 400, 'Invalid action for GET request.');
            }
        } else if (req.method === 'PUT') {
            if (action === 'updateUser') {
                if (!userId) return sendError(res, 400, 'User ID (Auth0 sub) is required for update.');
                if (!updates) return sendError(res, 400, 'Update data is required.');
                const updatePayload = { ...updates };
                const updateUrl = `${baseUrl}/${encodeURIComponent(userId)}`;
                const reqOptions = {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatePayload),
                };
                const response = await fetch(updateUrl, reqOptions);
                if (!response.ok) return sendError(res, response.status, 'Failed to update user in Auth0', await response.json());
                res.status(200).json(await response.json());
            } else if (action === 'assignRoles' || action === 'unassignRoles') {
                 if (!userId || !roles || !Array.isArray(roles)) return sendError(res, 400, 'User ID and a roles array are required.');

                const roleIdsPayload = [];
                if (roles.includes('admin')) { // Example: only handling 'admin' role for now
                    const rolesApiUrl = `${AUTH0_MANAGEMENT_AUDIENCE}roles`;
                    const getAdminRoleUrl = `${rolesApiUrl}?name_filter=admin`;
                    const adminRoleResponse = await fetch(getAdminRoleUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (adminRoleResponse.ok) {
                        const adminRolesData = await adminRoleResponse.json();
                        if (adminRolesData && adminRolesData.length > 0) {
                            roleIdsPayload.push(adminRolesData[0].id);
                        } else { console.warn("Admin role not found in Auth0 when trying to assign/unassign."); }
                    }
                }
                 if (roleIdsPayload.length === 0 && roles.length > 0) return sendError(res, 400, "Could not map provided role names to Auth0 Role IDs for this example.");

                 const rolesUrl = `${AUTH0_MANAGEMENT_AUDIENCE}users/${encodeURIComponent(userId)}/roles`;
                 const methodForRoles = action === 'assignRoles' ? 'POST' : 'DELETE';
                 const rolesResponse = await fetch(rolesUrl, { method: methodForRoles, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ roles: roleIdsPayload }) });
                 if (!rolesResponse.ok) return sendError(res, rolesResponse.status, `Failed to ${action} in Auth0`, await rolesResponse.json());
                 res.status(204).send();
            } else {
                sendError(res, 400, 'Invalid action for PUT request.');
            }
        } else if (req.method === 'DELETE') {
            if (action === 'deleteUser') {
                if (!userId) return sendError(res, 400, 'User ID (Auth0 sub) is required for deletion.');
                const deleteUrl = `${baseUrl}/${encodeURIComponent(userId)}`;
                const response = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (!response.ok) return sendError(res, response.status, 'Failed to delete user in Auth0', await response.json());
                res.status(204).send();
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

export const config = {
    api: {
        bodyParser: true,
    },
};