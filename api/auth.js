// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
import fetch from 'node-fetch'; // Make sure 'node-fetch' is in your backend/package.json and installed
import jwt from 'jsonwebtoken'; // For decoding JWTs (ID Token)

// Helper to send error responses
function sendError(res, statusCode, message, errorDetails) {
    console.error("Auth API Error:", message, errorDetails);
    res.status(statusCode).json({ error: message, details: errorDetails?.message || errorDetails });
}

// !!! IMPORTANT: This namespace MUST match the one used in your Auth0 Action that adds roles to tokens.
const ROLES_NAMESPACE = process.env.AUTH0_ROLES_NAMESPACE; // Define in .env

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
                    audience: process.env.AUTH0_AUDIENCE, // Audience for the tokens
                    scope: 'openid profile email offline_access', // Request standard claims + offline_access for refresh token
                    client_id: process.env.AUTH0_CLIENT_ID, // Client ID of your Auth0 RWA/Confidential application
                    client_secret: process.env.AUTH0_CLIENT_SECRET, // Client Secret of your Auth0 SPA (if it's confidential)
                    realm: 'Username-Password-Authentication'
                }),
            });

            if (!tokenResponse.ok) {
                const errorData = await tokenResponse.json();
                return sendError(res, tokenResponse.status, 'Auth0 authentication failed.', errorData);
            }

            const tokenData = await tokenResponse.json();

            // >>> Add this log to see the raw token data from Auth0 <<<
            console.log('Raw token data received from Auth0 /oauth/token:', tokenData);

            if (!tokenData.id_token) {
                return sendError(res, 500, 'Authentication successful, but ID token was not returned.', 'Ensure "openid" scope is requested and tenant settings allow ID tokens for ROPG.');
            }

            let decodedIdToken;
            try {
                // Decode the ID token to access its claims.
                // Note: This only decodes. For full security in some scenarios, you might verify the signature,
                // but since this token came directly from Auth0's /oauth/token endpoint after a successful
                // authenticated request from *your backend*, simple decoding is often acceptable here.
                decodedIdToken = jwt.decode(tokenData.id_token);
                if (!decodedIdToken) {
                    throw new Error('ID token could not be decoded.');
                }
            } catch (decodeError) {
                console.error('Error decoding ID token:', decodeError);
                return sendError(res, 500, 'Failed to process user identity.', decodeError.message);
            }

            // Extract roles from the custom claim using the defined namespace
            // Based on your decoded token, the claim name is ROLES_NAMESPACE + 'roles' (without an extra slash)
            const userRoles = decodedIdToken[`${ROLES_NAMESPACE}roles`] || [];
            if (!Array.isArray(userRoles)) {
                console.warn(`Roles claim (${ROLES_NAMESPACE}/roles) from ID token is not an array:`, userRoles);
                userRoles = []; // Default to empty array if not an array
            }

            // Construct user profile from ID token claims
            const userProfile = {
                id: decodedIdToken.sub, // Auth0 user ID is in 'sub' claim
                firstName: decodedIdToken.given_name || decodedIdToken.nickname || '',
                lastName: decodedIdToken.family_name || '',
                email: decodedIdToken.email,
                name: decodedIdToken.name || `${decodedIdToken.given_name || ''} ${decodedIdToken.family_name || ''}`.trim() || decodedIdToken.email,
                picture: decodedIdToken.picture, // User picture if available
            };

            // Return essential user info to the frontend.
            res.status(200).json({
                accessToken: tokenData.access_token,
                idToken: tokenData.id_token, // Optionally send ID token if frontend needs it for other reasons
                refreshToken: tokenData.refresh_token, // If offline_access scope was used
                profile: userProfile,
                roles: userRoles
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
