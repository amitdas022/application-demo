// api/auth.js
// Handles user authentication against Auth0 using the Resource Owner Password Grant (ROPG) flow.
// It retrieves user profile information and roles (via custom claims in the ID token).

// Load environment variables from .env file in development environments
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config(); // dotenv loads variables from .env into process.env
}
import fetch from 'node-fetch'; // Used for making HTTP requests to the Auth0 /oauth/token endpoint.
import jwt from 'jsonwebtoken'; // Used for decoding JWTs (specifically the ID Token from Auth0).

/**
 * Helper function to send standardized error responses.
 * @param {object} res - The Express response object.
 * @param {number} statusCode - The HTTP status code to send.
 * @param {string} message - A human-readable error message.
 * @param {object|string} [errorDetails] - Optional additional details about the error.
 */
function sendError(res, statusCode, message, errorDetails) {
    console.error("Auth API Error:", message, errorDetails);
    res.status(statusCode).json({ error: message, details: errorDetails?.message || errorDetails });
}

// The namespace for custom claims (like roles) added to the ID token by an Auth0 Action.
// This value MUST exactly match the namespace string used in your Auth0 Action script
// and is sourced from the AUTH0_ROLES_NAMESPACE environment variable.
const ROLES_NAMESPACE = process.env.AUTH0_ROLES_NAMESPACE;

/**
 * Main request handler for the /api/auth endpoint.
 * Handles POST requests for user login.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
export default async function handler(req, res) {
    // Only accept POST requests for authentication
    if (req.method === 'POST') {
        // Extract username (email) and password from the request body
        const { username, password } = req.body;

        // Validate that username and password are provided
        if (!username || !password) {
            return sendError(res, 400, 'Username and password are required.');
        }

        // Validate username format (email)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(username)) {
            return sendError(res, 400, 'Invalid username format. Please use a valid email address.');
        }

        try {
            // --- Auth0 ROPG Flow ---
            // Construct the URL for Auth0's token endpoint
            const auth0TokenUrl = `https://${process.env.AUTH0_DOMAIN}/oauth/token`;

            // Make a POST request to Auth0's /oauth/token endpoint
            const tokenResponse = await fetch(auth0TokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'password', // Specifies the ROPG flow
                    username: username,     // User's email (Auth0 typically uses email as username)
                    password: password,     // User's password
                    audience: process.env.AUTH0_AUDIENCE, // The identifier of the API the token is intended for (e.g., Auth0 Management API or your custom API)
                    scope: 'openid profile email offline_access', // Requested scopes: openid (for ID token), profile (user attributes), email, offline_access (for refresh token)
                    client_id: process.env.AUTH0_CLIENT_ID,       // Client ID of your Auth0 Regular Web Application (RWA) or Confidential Application
                    client_secret: process.env.AUTH0_CLIENT_SECRET, // Client Secret of your Auth0 RWA/Confidential Application
                    realm: 'Username-Password-Authentication' // Specifies the Auth0 connection to use (typically the default database connection)
                }),
            });

            // Handle unsuccessful token responses from Auth0
            if (!tokenResponse.ok) {
                const errorData = await tokenResponse.json();
                return sendError(res, tokenResponse.status, 'Auth0 authentication failed.', errorData);
            }

            // Parse the successful token response
            const tokenData = await tokenResponse.json();

            // Ensure an ID token was returned (it should be if 'openid' scope was requested)
            if (!tokenData.id_token) {
                return sendError(res, 500, 'Authentication successful, but ID token was not returned.', 'Ensure "openid" scope is requested and tenant settings allow ID tokens for ROPG.');
            }

            // --- ID Token Decoding ---
            let decodedIdToken;
            try {
                // Decode the ID token to access its claims (user profile information, roles, etc.).
                // Note: This only decodes the token. Full signature verification is not strictly necessary here
                // because the token was obtained directly from Auth0's trusted /oauth/token endpoint by this backend server
                // in a secure exchange. If the token were received from an untrusted source (e.g., client-side),
                // full verification (signature, issuer, audience, expiry) would be critical.
                decodedIdToken = jwt.decode(tokenData.id_token);
                if (!decodedIdToken) {
                    throw new Error('ID token could not be decoded or is malformed.');
                }
            } catch (decodeError) {
                // Handle errors during token decoding
                console.error('Error decoding ID token:', decodeError);
                return sendError(res, 500, 'Failed to process user identity.', decodeError.message);
            }

            // --- Roles Extraction ---
            // Extract roles from the custom claim in the decoded ID token.
            // The claim name is constructed by appending 'roles' to the ROLES_NAMESPACE.
            // E.g., if ROLES_NAMESPACE is 'https://myapp.example.com/', the claim is 'https://myapp.example.com/roles'.
            let userRoles = decodedIdToken[`${ROLES_NAMESPACE}roles`] || [];
            // Ensure userRoles is an array, defaulting to an empty array if the claim is missing or not an array.
            if (!Array.isArray(userRoles)) {
                console.warn(`Roles claim ('${ROLES_NAMESPACE}roles') from ID token is not an array:`, userRoles);
                userRoles = [];
            }

            // --- User Profile Construction ---
            // Construct a user profile object from standard and custom claims in the ID token.
            const userProfile = {
                id: decodedIdToken.sub, // 'sub' (subject) claim is the unique Auth0 user ID.
                firstName: decodedIdToken.given_name || decodedIdToken.nickname || '', // User's first name.
                lastName: decodedIdToken.family_name || '', // User's last name.
                email: decodedIdToken.email, // User's email address.
                name: decodedIdToken.name || `${decodedIdToken.given_name || ''} ${decodedIdToken.family_name || ''}`.trim() || decodedIdToken.email, // Full name, constructed if not directly available.
                picture: decodedIdToken.picture, // URL of the user's profile picture, if available.
            };

            // --- Successful Response ---
            // Return essential user information and tokens to the frontend.
            res.status(200).json({
                accessToken: tokenData.access_token,    // Access Token for calling secured APIs (audience specified in AUTH0_AUDIENCE).
                idToken: tokenData.id_token,            // ID Token containing user profile information.
                refreshToken: tokenData.refresh_token,  // Refresh Token (if 'offline_access' scope was granted) to obtain new access tokens.
                profile: userProfile,                   // Constructed user profile object.
                roles: userRoles                        // Array of user roles.
            });

        } catch (error) {
            // Catch-all for other errors
            console.error('Unhandled error in /api/auth:', error); // Log the full error server-side
            if (error.type === 'system') { // Example: DNS resolution, network connection error
                sendError(res, 503, 'Service unavailable. Please try again later.', 'Network or system error reaching authentication service.');
            } else if (error.response) { // Error from fetch itself, but not necessarily an Auth0 operational error
                sendError(res, error.response.status || 500, 'Authentication service communication error.', error.message);
            }
            else { // Other unexpected errors
                sendError(res, 500, 'An unexpected error occurred during authentication.', error.message || 'Internal Server Error');
            }
        }
    } else {
        // If the request method is not POST, respond with 405 Method Not Allowed.
        res.setHeader('Allow', ['POST']); // Indicate that only POST is allowed.
        sendError(res, 405, `Method ${req.method} Not Allowed`);
    }
}
