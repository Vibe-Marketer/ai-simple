// Generates a Composio OAuth connection link for Stripe
// Visit GET /api/composio-connect-stripe to authenticate with Stripe via Composio

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3';
const STRIPE_AUTH_CONFIG_ID = process.env.COMPOSIO_STRIPE_AUTH_CONFIG_ID || 'ac_CHQmlC58Ya5K';
const STRIPE_USER_ID = process.env.COMPOSIO_STRIPE_USER_ID;

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
        toolkit_slug: 'stripe',
        auth_config_id: STRIPE_AUTH_CONFIG_ID,
        user_id: STRIPE_USER_ID,
        redirect_url: 'https://aisimple.co/trial',
      }),
    });

    const data = await linkRes.json();

    if (!linkRes.ok) {
      console.error('Composio Stripe link error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Failed to create Stripe connection link', details: data });
    }

    return res.redirect(302, data.redirect_url);
  } catch (err) {
    console.error('Stripe connection error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
