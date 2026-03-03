// One-time setup: Creates Stripe product, price, and payment link for THE LAB trial
// GET /api/setup-trial-product to run
// After running, copy the payment link URL and update trial.html CTA buttons

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
    // Step 1: Create the product
    console.log('Creating product...');
    const productResult = await executeStripe('STRIPE_CREATE_A_PRODUCT', {
      name: 'THE LAB — 7-Day Backstage Pass',
      description: 'Full access to THE LAB for 7 days. Tools, automations, calls, WhatsApp, everything. Already earning $5K+/mo? You\'ll get a 20-minute clarity call to map your next move.',
    });

    if (!productResult.data?.id) {
      console.error('Product creation failed:', JSON.stringify(productResult));
      return res.status(500).json({ error: 'Failed to create product', details: productResult });
    }

    const productId = productResult.data.id;
    console.log('Product created:', productId);

    // Step 2: Create the price ($49 one-time)
    console.log('Creating price...');
    const priceResult = await executeStripe('STRIPE_CREATE_A_PRICE', {
      product: productId,
      unit_amount: 4900,
      currency: 'usd',
    });

    if (!priceResult.data?.id) {
      console.error('Price creation failed:', JSON.stringify(priceResult));
      return res.status(500).json({ error: 'Failed to create price', details: priceResult });
    }

    const priceId = priceResult.data.id;
    console.log('Price created:', priceId);

    // Step 3: Create the payment link
    console.log('Creating payment link...');
    const linkResult = await executeStripe('STRIPE_CREATE_PAYMENT_LINK', {
      line_items: [{ price: priceId, quantity: 1 }],
      after_completion: {
        type: 'redirect',
        redirect: { url: 'https://aisimple.co/thank-you?source=trial' },
      },
    });

    if (!linkResult.data?.url) {
      console.error('Payment link creation failed:', JSON.stringify(linkResult));
      return res.status(500).json({ error: 'Failed to create payment link', details: linkResult });
    }

    const paymentLinkUrl = linkResult.data.url;
    console.log('Payment link created:', paymentLinkUrl);

    return res.status(200).json({
      success: true,
      product_id: productId,
      price_id: priceId,
      payment_link_url: paymentLinkUrl,
      instructions: 'Copy the payment_link_url and update all trial-cta-link hrefs in public/trial.html, or set STRIPE_PAYMENT_LINK in .env',
    });
  } catch (err) {
    console.error('Setup error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
