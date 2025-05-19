// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
import { Client } from '@okta/okta-sdk-nodejs';

// Read Okta configuration from environment variables
const oktaClient = new Client({
    orgUrl: process.env.OKTA_ORG_URL,  // e.g., https://dev-123456.okta.com
    token: process.env.OKTA_API_TOKEN, // Okta API token
});

const adminGroupId = process.env.ADMIN_GROUP_ID; // Okta Admin Group ID

// Helper to send error responses
function sendError(res, statusCode, message, errorDetails) {
    console.error(message, errorDetails);
    res.status(statusCode).json({ error: message, details: errorDetails?.message || errorDetails });
}

export default async function handler(req, res) {
    const { action, userId, userData, updates } = req.body; // For POST/PUT/DELETE actions
    const queryAction = req.query.action; // For GET actions
    const queryUserId = req.query.userId; // For GET 'getUser' action

    // For actions requiring authentication/authorization, get the acting user's ID from headers.
    // THIS IS A SIMPLIFICATION FOR DEMO. IN PRODUCTION, VALIDATE A JWT OR SESSION TOKEN.
    const actingUserId = req.headers['x-user-id'];
    let actingUser = null;
    let isActingUserAdmin = false;

    if (actingUserId) {
        try {
            actingUser = await oktaClient.getUser(actingUserId);
            // Replace 'AdminGroup' with your actual Okta admin group name
            isActingUserAdmin = actingUser.profile.groups && actingUser.profile.groups.includes('AdminGroup');
        } catch (err) {
            // If actingUserId is provided but invalid, treat as unauthenticated for protected actions
            console.warn(`Could not fetch acting user ${actingUserId}:`, err.message);
        }
    }

    try {
        if (req.method === 'POST') {
            if (action === 'createUser') {
                // Example: Only admins can create users
                if (!isActingUserAdmin) {
                    return sendError(res, 403, 'Forbidden. Admin privileges required to create users.');
                }
                if (!userData) return sendError(res, 400, 'User data is required for creation.');
                const newUser = await oktaClient.createUser(userData);
                res.status(201).json(newUser);
            } else {
                sendError(res, 400, 'Invalid action for POST request.');
            }
        } else if (req.method === 'GET') {
            if (queryAction === 'listUsers') {
                const users = [];
                for await (const user of oktaClient.listUsers()) {
                    users.push(user);
                }
                res.status(200).json(users);
            } else if (queryAction === 'getUser') {
                if (!queryUserId) return sendError(res, 400, 'User ID is required.');
                const user = await oktaClient.getUser(queryUserId);
                res.status(200).json(user);
            } else {
                sendError(res, 400, 'Invalid action for GET request.');
            }
        } else if (req.method === 'PUT' || req.method === 'DELETE') { // Combined PUT and DELETE logic for auth check
             // Authentication check for methods that modify data
            if (!actingUser) { // If no acting user could be determined (e.g., no x-user-id or invalid id)
                return sendError(res, 401, 'Authentication required for this operation.');
            }

            if (req.method === 'PUT') {
                if (action === 'addToAdminGroup') {
                    if (!isActingUserAdmin) {
                        return sendError(res, 403, 'Forbidden. Admin privileges required.');
                    }
                    if (!adminGroupId) return sendError(res, 500, 'Admin Group ID is not configured.');
                    if (!userId) return sendError(res, 400, 'User ID is required.');
                    await oktaClient.groupApi.assignUserToGroup({ groupId: adminGroupId, userId });
                    res.status(200).json({ success: true, message: 'User added to admin group.' });
                } else if (action === 'updateUser') {
                    if (!isActingUserAdmin) {
                         return sendError(res, 403, 'Forbidden. Admin privileges required to update users.');
                    }
                    if (!userId) return sendError(res, 400, 'User ID is required for update.');
                    if (!updates) return sendError(res, 400, 'Update data is required.');

                    const userToUpdate = await oktaClient.userApi.getUser({ userId });
                    if (updates.profile) {
                        Object.assign(userToUpdate.profile, updates.profile);
                    }
                    const updatedUser = await oktaClient.userApi.updateUser({ userId, user: userToUpdate });
                    res.status(200).json(updatedUser);
                } else {
                    sendError(res, 400, 'Invalid action for PUT request.');
                }
            } else if (req.method === 'DELETE') {
                if (action === 'deleteUser') {
                    if (!isActingUserAdmin) {
                        return sendError(res, 403, 'Forbidden. Admin privileges required to delete users.');
                    }
                    if (!userId) return sendError(res, 400, 'User ID is required for deletion.');
                    try {
                        await oktaClient.userApi.deactivateUser({ userId });
                    } catch (deactivateError) {
                        console.warn(`Attempted to deactivate user ${userId} before deletion:`, deactivateError.message);
                    }
                    await oktaClient.userApi.deleteUser({ userId });
                    res.status(200).json({ success: true, message: 'User deleted successfully.' });
                } else {
                    sendError(res, 400, 'Invalid action for DELETE request.');
                }
            }
        } else {
            res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
            sendError(res, 405, `Method ${req.method} Not Allowed`);
        }
    } catch (error) {
        sendError(res, error.status || 500, 'Okta API operation failed.', error);
    }
}

export const config = {
    api: {
        bodyParser: true, // Ensure body parsing is enabled
    },
};