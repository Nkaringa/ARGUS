const API_KEY = process.env.API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

// Sets CORS headers and short-circuits OPTIONS preflight.
// X-Api-Key is listed so the browser's preflight allows it.
function corsMiddleware(req, res, next) {
    res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
}

// Rejects requests missing the correct API key.
// If API_KEY is not set in .env, auth is disabled (local dev default).
function authMiddleware(req, res, next) {
    if (!API_KEY) return next();
    if (req.headers['x-api-key'] !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Returns true if the WebSocket upgrade request is authorized.
// Key is expected as a query param: ws://host:port?key=<API_KEY>
// If API_KEY is not set, all connections are allowed.
function wsAuth(req) {
    if (!API_KEY) return true;
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get('key') === API_KEY;
}

module.exports = { corsMiddleware, authMiddleware, wsAuth };
