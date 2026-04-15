// Vercel serverless function: proxies all Sandbox.co.in API calls
// Caches auth token locally across warm invocations.

let cachedToken = null;
let tokenExpiry = 0;

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const baseUrl = process.env.VITE_SANDBOX_URL || 'https://api.sandbox.co.in';
  const apiKey = process.env.VITE_SANDBOX_API_KEY || '';
  const apiSecret = process.env.VITE_SANDBOX_API_SECRET || '';

  try {
    // 1. Authenticate if no valid token
    if (!cachedToken || Date.now() > tokenExpiry) {
      const authRes = await fetch(`${baseUrl}/authenticate`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret, 'Content-Type': 'application/json' }
      });
      const authData = await authRes.json();
      if (authData.access_token) {
        cachedToken = authData.access_token;
        tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
      } else {
        return res.status(401).json({ error: 'Sandbox Auth Failed', details: authData });
      }
    }

    // 2. Fetch Sandbox Data
    const sandboxPath = req.url.replace(/^\/api\/sandbox/, '');
    const targetUrl = `${baseUrl}${sandboxPath}`;

    const fetchOptions = {
      method: req.method,
      headers: {
        'x-api-key': apiKey,
        'authorization': `Bearer ${cachedToken}`,
        'x-api-version': '1.0',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, fetchOptions);
    const data = await upstream.text(); // Parse as Text incase empty

    res.status(upstream.status).send(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Proxy error' });
  }
}
