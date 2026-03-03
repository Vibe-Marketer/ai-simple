// Generates a Composio OAuth connection link for Google Drive
// Visit GET /api/composio-connect-googledrive to authenticate with Google Drive via Composio

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3';
const GOOGLEDRIVE_AUTH_CONFIG_ID = process.env.COMPOSIO_GOOGLEDRIVE_AUTH_CONFIG_ID;
const GOOGLEDRIVE_USER_ID = process.env.COMPOSIO_GOOGLEDRIVE_USER_ID;

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
        toolkit_slug: 'googledrive',
        auth_config_id: GOOGLEDRIVE_AUTH_CONFIG_ID,
        user_id: GOOGLEDRIVE_USER_ID,
        redirect_url: 'https://aisimple.co/trial',
      }),
    });

    const data = await linkRes.json();

    if (!linkRes.ok) {
      console.error('Composio Google Drive link error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Failed to create Google Drive connection link', details: data });
    }

    return res.redirect(302, data.redirect_url);
  } catch (err) {
    console.error('Google Drive connection error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
