// api/config.js
export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const config = {
                oktaDomain: process.env.AUTH0_DOMAIN, // Reusing AUTH0_DOMAIN for Okta domain
                oktaClientId: process.env.AUTH0_CLIENT_ID, // Reusing AUTH0_CLIENT_ID for Okta client ID
                oktaAudience: process.env.AUTH0_AUDIENCE, // Reusing AUTH0_AUDIENCE for Okta audience
                // Add any other client-side specific configs here if needed
            };

            // Basic validation to ensure essential configs are present
            if (!config.oktaDomain || !config.oktaClientId) {
                console.error('[API Config Error] Essential Okta configuration (domain or client ID) is missing from environment variables.');
                return res.status(500).json({ error: 'Server configuration error: Essential client configurations are missing.' });
            }

            console.log('[API Config] Sending client configuration:', { oktaDomain: config.oktaDomain, oktaClientId: config.oktaClientId, oktaAudience: config.oktaAudience ? 'Present' : 'Not Present' });
            res.status(200).json(config);

        } catch (error) {
            console.error('[API Config Error] Failed to retrieve configuration:', error);
            res.status(500).json({ error: 'Internal server error while retrieving configuration.' });
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
}

export const config = {
    api: {
        bodyParser: false, // No body parsing needed for GET
    },
};
