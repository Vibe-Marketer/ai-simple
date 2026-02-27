// Generates a fresh Composio OAuth connection link for Grace's Gmail
// Visit GET /api/composio-connect-grace to get the link URL

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const linkRes = await fetch(`${COMPOSIO_BASE}/connected_accounts/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        toolkit_slug: 'gmail',
        auth_config_id: 'ac_6uf1pFyGz84d',
        user_id: 'grace-leveragedcre',
        redirect_url: 'https://aisimple.co/cre-thanks',
      }),
    });

    const data = await linkRes.json();

    if (!linkRes.ok) {
      console.error('Composio link error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Failed to create connection link', details: data });
    }

    // Redirect the user to the OAuth consent screen
    return res.redirect(302, data.redirect_url);
  } catch (err) {
    console.error('Connection link error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
