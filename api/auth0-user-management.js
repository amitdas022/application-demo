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
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: AUTH0_M2M_CLIENT_ID,
                client_secret: AUTH0_M2M_CLIENT_SECRET,
                audience: AUTH0_MANAGEMENT_AUDIENCE,
                grant_type: 'client_credentials',
            }),
        });
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
    const { action, userId, userData, updates, roles } = req.body; // userId is Auth0 user_id (sub) or email for lookup
    const queryAction = req.query.action;
    const queryUserId = req.query.userId; // Auth0 user_id (sub)

    try {
        const token = await getManagementApiToken();
        const baseUrl = `${AUTH0_MANAGEMENT_AUDIENCE}users`; // Management API users endpoint

        // Authorization: Check if the acting user (from X-Auth0-User-Email) has admin role in Auth0
        // This part needs to be implemented based on how you pass the acting user's identity
        // For simplicity, we'll assume all calls to this endpoint are from an "admin" context for now.
        // In a real app, you'd validate a JWT from the frontend for the acting user.
        // const actingUserEmail = req.headers['x-auth0-user-email'];
        // if (!actingUserEmail) return sendError(res, 401, "Unauthorized: Missing acting user email.");
        // TODO: Fetch acting user from Auth0 using 'actingUserEmail' and check their roles.

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
                    connection: 'Username-Password-Authentication', // Or your default DB connection
                    email_verified: true, // Optional
                    // app_metadata: { roles: ['user'] } // Example of setting roles
                };
                const response = await fetch(baseUrl, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(createUserData),
                });
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
                const response = await fetch(`${baseUrl}/${encodeURIComponent(queryUserId)}`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (!response.ok) return sendError(res, response.status, 'Failed to get user from Auth0', await response.json());
                res.status(200).json(await response.json());
            } else {
                sendError(res, 400, 'Invalid action for GET request.');
            }
        } else if (req.method === 'PUT') {
            if (action === 'updateUser') { // userId is Auth0 user_id (sub)
                if (!userId) return sendError(res, 400, 'User ID (Auth0 sub) is required for update.');
                if (!updates) return sendError(res, 400, 'Update data is required.');
                const updatePayload = { ...updates }; // e.g., { given_name: "NewName" }
                const response = await fetch(`${baseUrl}/${encodeURIComponent(userId)}`, {
                    method: 'PATCH', // Use PATCH for partial updates
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatePayload),
                });
                if (!response.ok) return sendError(res, response.status, 'Failed to update user in Auth0', await response.json());
                res.status(200).json(await response.json());
            } else if (action === 'assignRoles') { // userId is Auth0 user_id (sub)
                 if (!userId || !roles || !Array.isArray(roles)) return sendError(res, 400, 'User ID and a roles array are required.');
                 // First, get existing roles to avoid duplicates or to remove all then add
                 // For simplicity, this example just assigns. A real app might want to replace.
                 const roleIdsToAssign = []; // You'd map role names to Auth0 role IDs here
                 // This requires you to know the Auth0 Role IDs.
                 // Example: if (roles.includes('admin')) roleIdsToAssign.push('auth0_role_id_for_admin');
                 // This part is highly dependent on how you manage roles and get their IDs.
                 // For now, this is a placeholder. You'd typically fetch role IDs by name first.
                 // const assignRolesUrl = `${AUTH0_MANAGEMENT_AUDIENCE}users/${encodeURIComponent(userId)}/roles`;
                 // const response = await fetch(assignRolesUrl, {
                 //    method: 'POST',
                 //    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                 //    body: JSON.stringify({ roles: roleIdsToAssign /* array of Auth0 Role IDs */ }),
                 // });
                 // if (!response.ok) return sendError(res, response.status, 'Failed to assign roles in Auth0', await response.json());
                 // res.status(204).send(); // No content on successful role assignment
                 return sendError(res, 501, "Role assignment not fully implemented. Requires mapping role names to Auth0 Role IDs.");
            } else {
                sendError(res, 400, 'Invalid action for PUT request.');
            }
        } else if (req.method === 'DELETE') {
            if (action === 'deleteUser') { // userId is Auth0 user_id (sub)
                if (!userId) return sendError(res, 400, 'User ID (Auth0 sub) is required for deletion.');
                const response = await fetch(`${baseUrl}/${encodeURIComponent(userId)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (!response.ok) return sendError(res, response.status, 'Failed to delete user in Auth0', await response.json());
                res.status(204).send(); // No content on successful deletion
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