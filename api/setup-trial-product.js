// One-time setup: Creates Stripe product and price for THE LAB trial via Composio
// GET /api/setup-trial-product to run
// Product + price already created:
//   Product: prod_U59lJeZpQK4CDH
//   Price:   price_1T6zRwGj1WiXtQOWU4W6g5Yp ($49 one-time)
// Payment link must be created in Stripe Dashboard (not available via Composio)

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3';
const STRIPE_USER_ID = 'pg-test-e7af580e-232f-4e5c-9529-c7791fb36806';

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
    // Step 1: Create the product
    console.log('Creating product...');
    const productResult = await executeStripe('STRIPE_CREATE_PRODUCT', {
      name: 'THE LAB — 7-Day Backstage Pass',
      description: 'Full access to THE LAB for 7 days. Tools, automations, calls, WhatsApp, everything. Already earning $5K+/mo? You\'ll get a 20-minute clarity call to map your next move.',
    });

    if (!productResult.data?.data?.id) {
      console.error('Product creation failed:', JSON.stringify(productResult));
      return res.status(500).json({ error: 'Failed to create product', details: productResult });
    }

    const productId = productResult.data.data.id;
    console.log('Product created:', productId);

    // Step 2: Create the price ($49 one-time)
    console.log('Creating price...');
    const priceResult = await executeStripe('STRIPE_CREATE_PRICE', {
      product: productId,
      unit_amount: 4900,
      currency: 'usd',
    });

    if (!priceResult.data?.data?.id) {
      console.error('Price creation failed:', JSON.stringify(priceResult));
      return res.status(500).json({ error: 'Failed to create price', details: priceResult });
    }

    const priceId = priceResult.data.data.id;
    console.log('Price created:', priceId);

    return res.status(200).json({
      success: true,
      product_id: productId,
      price_id: priceId,
      next_step: 'Create a Payment Link in Stripe Dashboard: Products → THE LAB → Create payment link. Set redirect to https://aisimple.co/thank-you?source=trial',
    });
  } catch (err) {
    console.error('Setup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
