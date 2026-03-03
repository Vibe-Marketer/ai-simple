// Lists existing Stripe products, prices, and payment links via Composio
// GET /api/list-stripe-products

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3';
const STRIPE_USER_ID = 'andrew-aisimple';

async function executeStripe(action, args) {
  const res = await fetch(`${COMPOSIO_BASE}/tools/execute/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': COMPOSIO_API_KEY,
    },
    body: JSON.stringify({
      user_id: STRIPE_USER_ID,
      arguments: args,
    }),
  });
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const productsResult = await executeStripe('STRIPE_LIST_ALL_PRODUCTS', {
      limit: 20,
      active: true,
    });

    const pricesResult = await executeStripe('STRIPE_LIST_ALL_PRICES', {
      limit: 20,
      active: true,
    });

    const linksResult = await executeStripe('STRIPE_LIST_ALL_PAYMENT_LINKS', {
      limit: 20,
      active: true,
    });

    return res.status(200).json({
      products: productsResult.data,
      prices: pricesResult.data,
      payment_links: linksResult.data,
    });
  } catch (err) {
    console.error('List products error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
