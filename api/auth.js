// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
import fetch from 'node-fetch'; // Make sure 'node-fetch' is in your backend/package.json and installed

// Helper to send error responses
function sendError(res, statusCode, message, errorDetails) {
    console.error("Auth API Error:", message, errorDetails);
    res.status(statusCode).json({ error: message, details: errorDetails?.message || errorDetails });
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { username, password } = req.body;

        if (!username || !password) {
            return sendError(res, 400, 'Username and password are required.');
        }

        try {
            // Auth0 ROPG flow
            const auth0TokenUrl = `https://${process.env.AUTH0_DOMAIN}/oauth/token`;
            const tokenResponse = await fetch(auth0TokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'password',
                    username: username, // Auth0 typically uses email as username
                    password: password,
                    audience: process.env.AUTH0_AUDIENCE, // Audience for your SPA's API or the Management API if directly calling it
                    scope: 'openid profile email', // Request necessary scopes
                    client_id: process.env.AUTH0_CLIENT_ID, // Client ID of your Auth0 SPA application
                    client_secret: process.env.AUTH0_CLIENT_SECRET, // Client Secret of your Auth0 SPA (if it's confidential)
                }),
            });

            if (!tokenResponse.ok) {
                const errorData = await tokenResponse.json();
                return sendError(res, tokenResponse.status, 'Auth0 authentication failed.', errorData);
            }

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            // Fetch user profile from Auth0 /userinfo endpoint
            const userInfoUrl = `https://${process.env.AUTH0_DOMAIN}/userinfo`;
            const userInfoResponse = await fetch(userInfoUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!userInfoResponse.ok) {
                const errorData = await userInfoResponse.json();
                return sendError(res, userInfoResponse.status, 'Failed to fetch user info from Auth0.', errorData);
            }

            const auth0User = await userInfoResponse.json();

            // Extract roles. The exact location of roles depends on your Auth0 setup (Rules/Actions).
            // Common places: a custom claim (e.g., https://myapp.example.com/roles) or directly if using Auth0 RBAC Core.
            const namespace = 'https://application-demo.com/claims'; // Your defined namespace
            // Assuming your Auth0 Action adds roles to a claim like 'https://application-demo.com/claims/roles'
            const userRoles = auth0User[`${namespace}/roles`] || (auth0User.roles || []);


            // Return essential user info to the frontend.
            res.status(200).json({
                id: auth0User.sub, // Auth0 user ID is in 'sub' claim
                profile: {
                    firstName: auth0User.given_name || auth0User.nickname || '',
                    lastName: auth0User.family_name || '',
                    email: auth0User.email,
                    name: auth0User.name || `${auth0User.given_name || ''} ${auth0User.family_name || ''}`.trim() || auth0User.email,
                },
                roles: userRoles // Send roles to the frontend
            });

        } catch (error) {
            // Handle other errors during authentication
            sendError(res, error.status || 500, 'Error during authentication process.', error.message || error);
        }
    } else {
        res.setHeader('Allow', ['POST']);
        sendError(res, 405, `Method ${req.method} Not Allowed`);
    }
}
