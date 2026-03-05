// Creates THE LAB Membership product + prices in Stripe via Composio
// Run once to set up products, then create payment links manually in Stripe Dashboard.

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3';

async function executeComposioTool(action, userId, args) {
  const res = await fetch(`${COMPOSIO_BASE}/tools/execute/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': COMPOSIO_API_KEY,
    },
    body: JSON.stringify({
      user_id: userId,
      arguments: args,
    }),
  });
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.SETUP_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const stripeUserId = process.env.COMPOSIO_STRIPE_USER_ID;

    // 1. Create the product
    const productResult = await executeComposioTool(
      'STRIPE_CREATE_PRODUCT',
      stripeUserId,
      {
        name: 'THE LAB Membership',
        description: 'Full access to THE LAB — The Room, The Drive, Partnership. Tools, automations, workflows, WhatsApp community, weekly calls.',
      }
    );

    const productId = productResult?.response_data?.id || productResult?.data?.id;
    if (!productId) {
      return res.status(500).json({ error: 'Failed to create product', detail: productResult });
    }

    // 2. Create Price A: $297 every 28 days
    const priceA = await executeComposioTool(
      'STRIPE_CREATE_PRICE',
      stripeUserId,
      {
        product: productId,
        unit_amount: 29700,
        currency: 'usd',
        recurring: {
          interval: 'day',
          interval_count: 28,
        },
      }
    );

    // 3. Create Price B: $2,997/year
    const priceB = await executeComposioTool(
      'STRIPE_CREATE_PRICE',
      stripeUserId,
      {
        product: productId,
        unit_amount: 299700,
        currency: 'usd',
        recurring: {
          interval: 'year',
          interval_count: 1,
        },
      }
    );

    return res.status(200).json({
      product_id: productId,
      price_a_28day: priceA?.response_data?.id || priceA?.data?.id,
      price_b_yearly: priceB?.response_data?.id || priceB?.data?.id,
      next_steps: [
        '1. Create subscription checkout: $49 one-time + Price A with 7-day trial → success_url: /trial-upsell',
        '2. Create payment link for Price B (annual) → redirect to /welcome?plan=annual',
        '3. Enable Smart Retries + failed payment customer emails in Stripe Dashboard',
      ],
    });
  } catch (err) {
    console.error('Setup error:', err);
    return res.status(500).json({ error: 'Setup failed', message: err.message });
  }
}
