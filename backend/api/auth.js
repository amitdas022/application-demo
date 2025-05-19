// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
import { Client } from '@okta/okta-sdk-nodejs';

// Read Okta configuration from environment variables
const oktaClient = new Client({
    orgUrl: process.env.OKTA_ORG_URL,
    token: process.env.OKTA_API_TOKEN, // Okta API token (used here to fetch user details after successful auth)
});

// Helper to send error responses
function sendError(res, statusCode, message, errorDetails) {
    console.error(message, errorDetails);
    res.status(statusCode).json({ error: message, details: errorDetails?.message || errorDetails });
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { username, password } = req.body;

        if (!username || !password) {
            return sendError(res, 400, 'Username and password are required.');
        }

        try {
            // Use the Okta SDK to authenticate the user with credentials
            const transaction = await oktaClient.authN.authenticate({ username, password });

            if (transaction.status === 'SUCCESS') {
                // Authentication successful. Fetch the full user object including groups.
                const user = await oktaClient.getUser(transaction.session.userId);
                // Return essential user info to the frontend
                res.status(200).json({
                    id: user.id,
                    profile: user.profile,
                    groups: user.profile.groups // Assuming groups are in profile or fetch separately if needed
                });
            } else {
                sendError(res, 401, 'Authentication failed.', { status: transaction.status });
            }
        } catch (error) {
            // Handle Okta API errors during authentication
            sendError(res, error.status || 500, 'Error during authentication.', error);
        }
    } else {
        res.setHeader('Allow', ['POST']);
        sendError(res, 405, `Method ${req.method} Not Allowed`);
    }
}