// api/auth.js
// Handles user authentication against Auth0 using the Authorization Code Flow.
// It exchanges the authorization code received from the frontend for ID, Access, and Refresh tokens.

// Load environment variables from .env file in development environments
// This ensures process.env variables are available locally.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

// Import node-fetch for making HTTP requests.
// This is typically needed in Node.js environments for fetch API functionality.
import fetch from 'node-fetch';

// Import jsonwebtoken for decoding JWTs (specifically the ID Token from Auth0).
import jwt from 'jsonwebtoken';

/**
 * Helper function to send standardized error responses.
 * This function logs the error internally and sends a JSON response to the client.
 * @param {object} res - The Express-like response object provided by Vercel.
 * @param {number} statusCode - The HTTP status code to send (e.g., 400, 401, 500).
 * @param {string} message - A human-readable error message for the client.
 * @param {object|string} [errorDetails] - Optional additional details about the error,
 * which can be an Error object or a string.
 */
function sendError(res, statusCode, message, errorDetails) {
    // Log the error details to the console for debugging on the server.
    // Use optional chaining for errorDetails.message as it might be a string or object.
    console.error("[Auth API Error]", message, errorDetails?.message || errorDetails);

    // Send the error response to the client in JSON format.
    res.status(statusCode).json({ error: message, details: errorDetails?.message || errorDetails });
}

// The namespace for custom claims (like roles) added to the ID token by an Auth0 Action.
// This value MUST exactly match the namespace string used in your Auth0 Action script
// and is sourced from the AUTH0_ROLES_NAMESPACE environment variable.
// Example: If your Auth0 Action sets a claim 'https://my-app.com/roles', then
// AUTH0_ROLES_NAMESPACE should be 'https://my-app.com/'.
// const ROLES_NAMESPACE = process.env.AUTH0_ROLES_NAMESPACE; // Commented out for Okta integration

/**
 * Main request handler for the /api/auth endpoint.
 * This function is designed to be a Vercel Serverless Function.
 * It handles POST requests containing the authorization code from the frontend,
 * exchanges it with Auth0 for tokens, and returns user data to the client.
 * @param {object} req - The request object (from Node.js HTTP server, extended by Vercel).
 * For POST requests, `req.body` will contain the JSON payload.
 * @param {object} res - The response object (from Node.js HTTP server, extended by Vercel).
 */
export default async function handler(req, res) {
    // Log incoming request details for debugging.
    console.log(`[Auth API Handler] Received request: ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log(`[Auth API Handler] Request body:`, req.body);
    }

    // This endpoint is specifically designed to handle the POST request
    // from your frontend's /callback.html page.
    if (req.method === 'POST') {
        // Extract the authorization `code` AND `redirect_uri` from the request body.
        // The frontend sends these after receiving them from Auth0's redirect.
        const { code, redirect_uri } = req.body; // <-- MODIFIED HERE: Extracting redirect_uri from req.body

        // Basic validation: Check if an authorization code and redirect_uri were actually provided.
        if (!code) {
            return sendError(res, 400, 'Authorization code is missing from the request body.');
        }
        if (!redirect_uri) {
            return sendError(res, 400, 'Redirect URI is missing from the request body. It is required for token exchange.');
        }


        try {
            // --- Okta Authorization Code Exchange ---
            // Construct the URL for Okta's token endpoint.
            const oktaTokenUrl = `https://${process.env.AUTH0_DOMAIN}/oauth2/default/v1/token`;

            // Log the details of the token exchange request being sent to Okta.
            console.log(`[Auth API] Sending token exchange request to Okta. URL: ${oktaTokenUrl}`);
            console.log(`[Auth API] Payload (excluding secret):`, {
                grant_type: 'authorization_code',
                client_id: process.env.AUTH0_CLIENT_ID,
                code: code,
                redirect_uri: redirect_uri, // <-- MODIFIED HERE: Using the redirect_uri received from the frontend
                audience: process.env.AUTH0_AUDIENCE,
                scope: 'openid profile email offline_access'
            });

            // Make a POST request to Okta's `/oauth/token` endpoint.
            // This is a server-to-server communication, keeping the `client_secret` secure.
            const tokenResponse = await fetch(oktaTokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'authorization_code',          // Specifies the Authorization Code Flow.
                    client_id: process.env.AUTH0_CLIENT_ID,    // Your Auth0 Application's Client ID.
                    client_secret: process.env.AUTH0_CLIENT_SECRET, // Your Auth0 Application's Client Secret.
                    code: code,                                // The authorization code obtained from Auth0.
                    redirect_uri: redirect_uri,                // <-- MODIFIED HERE: Using the redirect_uri received from the frontend
                    audience: process.env.AUTH0_AUDIENCE,      // The identifier of the API the token is for (optional for OIDC).
                    // Scopes must match what was requested in the initial /authorize call.
                    // 'openid' is required for ID Token, 'profile' and 'email' for user info,
                    // 'offline_access' for a Refresh Token (if enabled in Auth0).
                    scope: 'openid profile email offline_access'
                }),
            });

            // Clone the response to safely read its body for logging, then process the original response.
            const responseBodyForLogging = await tokenResponse.clone().json().catch(() => tokenResponse.clone().text());
            console.log(`[Auth API] Okta token exchange response. Status: ${tokenResponse.status}, Body:`, responseBodyForLogging);


            // Check if the token exchange request to Okta was successful.
            if (!tokenResponse.ok) {
                const errorData = await tokenResponse.json(); // Parse Okta's error response.
                console.error("[Auth API Error] Okta Token Exchange Failed:", errorData);
                return sendError(res, tokenResponse.status, 'Okta token exchange failed.', errorData);
            }

            // Parse the successful response from Okta, which contains the tokens.
            const tokenData = await tokenResponse.json();

            // Ensure an ID token was returned. The 'openid' scope should guarantee this.
            if (!tokenData.id_token) {
                console.error("[Auth API Error] ID Token missing after successful exchange.");
                return sendError(res, 500, 'Token exchange successful, but ID token was not returned.', 'Ensure "openid" scope is requested in your Okta application setup.');
            }

            // --- ID Token Decoding ---
            let decodedIdToken;
            try {
                decodedIdToken = jwt.decode(tokenData.id_token);
                if (!decodedIdToken) {
                    throw new Error('ID token could not be decoded or is malformed.');
                }
                console.log(`[Auth API] Successfully decoded ID Token. User ID: ${decodedIdToken.sub}`);
            } catch (decodeError) {
                console.error("[Auth API Error] Error decoding ID token:", decodeError);
                return sendError(res, 500, 'Failed to process user identity from ID token.', decodeError.message);
            }

            // --- Roles Extraction ---
            // Assuming 'groups' claim contains roles for Okta
            let userRoles = decodedIdToken.groups || [];
            if (!Array.isArray(userRoles)) {
                // If groups claim is present but not an array, log a warning and default to empty array.
                // This handles cases where the claim might be unexpectedly formatted.
                if (decodedIdToken.groups !== undefined) {
                    console.warn(`[Auth API Warning] 'groups' claim from ID token is not an array:`, decodedIdToken.groups);
                }
                userRoles = [];
            }
            console.log(`[Auth API] User roles extracted from 'groups' claim:`, userRoles);

            // --- User Profile Construction ---
            const userProfile = {
                id: decodedIdToken.sub,
                firstName: decodedIdToken.given_name || decodedIdToken.nickname || '',
                lastName: decodedIdToken.family_name || '',
                email: decodedIdToken.email,
                name: decodedIdToken.name || `${decodedIdToken.given_name || ''} ${decodedIdToken.family_name || ''}`.trim() || decodedIdToken.email,
                picture: decodedIdToken.picture,
            };
            console.log(`[Auth API] User profile constructed:`, userProfile);

            // --- Successful Response ---
            // Send back the essential user information and tokens to the frontend.
            console.log(`[Auth API] Authentication successful for user ${userProfile.email}.`);
            res.status(200).json({
                accessToken: tokenData.access_token,
                idToken: tokenData.id_token,
                refreshToken: tokenData.refresh_token,
                profile: userProfile,
                roles: userRoles
            });

        } catch (error) {
            console.error("[Auth API Error] Internal server error during authentication process:", error);
            sendError(res, error.status || 500, 'Internal server error during authentication process.', error.message || error);
        }
    } else {
        console.warn(`[Auth API Handler] Method Not Allowed: ${req.method}`);
        res.setHeader('Allow', ['POST']);
        sendError(res, 405, `Method ${req.method} Not Allowed`);
    }
}

// Vercel specific configuration: enables Next.js API routes to parse the request body.
// This is necessary for `req.body` to be populated with the JSON sent from the frontend.
export const config = {
    api: {
        bodyParser: true, // Enable body parsing for this API route.
    },
};