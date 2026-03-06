// Creates THE LAB Membership product, prices, and payment links in Stripe via Composio.
// POST /api/setup-lab-membership (requires SETUP_SECRET auth)
// Run once to set up the full subscription flow.

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3';

async function stripe(action, args) {
  const res = await fetch(`${COMPOSIO_BASE}/tools/execute/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': COMPOSIO_API_KEY,
    },
    body: JSON.stringify({
      user_id: process.env.COMPOSIO_STRIPE_USER_ID,
      arguments: args,
    }),
  });
  const json = await res.json();
  // Composio wraps responses differently — normalize
  return json?.data?.data || json?.response_data || json?.data || json;
}

function getId(result) {
  return result?.id || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.SETUP_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = {};

  try {
    // Step 1: Create the subscription product
    console.log('Step 1: Creating product...');
    const product = await stripe('STRIPE_CREATE_PRODUCT', {
      name: 'THE LAB Membership',
      description: 'Full access to THE LAB — The Room, The Drive, Partnership. Tools, automations, workflows, WhatsApp community, weekly calls.',
    });
    results.product = product;
    const productId = getId(product);
    if (!productId) {
      return res.status(500).json({ error: 'Failed to create product', results });
    }
    console.log('Product created:', productId);

    // Step 2: Create $49 one-time setup price (the trial entry fee)
    console.log('Step 2: Creating $49 one-time price...');
    const price49 = await stripe('STRIPE_CREATE_PRICE', {
      product: productId,
      unit_amount: 4900,
      currency: 'usd',
    });
    results.price_49_onetime = price49;
    const price49Id = getId(price49);
    console.log('$49 price created:', price49Id);

    // Step 3: Create $297/28-day recurring price
    console.log('Step 3: Creating $297/28-day recurring price...');
    const price297 = await stripe('STRIPE_CREATE_PRICE', {
      product: productId,
      unit_amount: 29700,
      currency: 'usd',
      recurring: {
        interval: 'day',
        interval_count: 28,
      },
    });
    results.price_297_recurring = price297;
    const price297Id = getId(price297);
    console.log('$297 recurring price created:', price297Id);

    // Step 4: Create $2,997/year recurring price
    console.log('Step 4: Creating $2,997/year price...');
    const price2997 = await stripe('STRIPE_CREATE_PRICE', {
      product: productId,
      unit_amount: 299700,
      currency: 'usd',
      recurring: {
        interval: 'year',
        interval_count: 1,
      },
    });
    results.price_2997_yearly = price2997;
    const price2997Id = getId(price2997);
    console.log('$2,997 yearly price created:', price2997Id);

    // Step 5: Create payment link for trial ($49 one-time + $297 recurring with 7-day trial)
    console.log('Step 5: Creating trial payment link...');
    let trialLink = null;
    try {
      trialLink = await stripe('STRIPE_CREATE_PAYMENT_LINK', {
        line_items: [
          { price: price49Id, quantity: 1 },
          { price: price297Id, quantity: 1 },
        ],
        subscription_data: {
          trial_period_days: 7,
        },
        after_completion: {
          type: 'redirect',
          redirect: { url: 'https://aisimple.co/trial-upsell' },
        },
      });
      results.trial_payment_link = trialLink;
      console.log('Trial payment link:', trialLink?.url || trialLink);
    } catch (e) {
      console.error('Payment link creation failed, trying alternative...', e.message);
      results.trial_payment_link_error = e.message;
    }

    // Step 6: Create payment link for annual upgrade
    console.log('Step 6: Creating annual payment link...');
    let annualLink = null;
    try {
      annualLink = await stripe('STRIPE_CREATE_PAYMENT_LINK', {
        line_items: [
          { price: price2997Id, quantity: 1 },
        ],
        after_completion: {
          type: 'redirect',
          redirect: { url: 'https://aisimple.co/welcome?plan=annual' },
        },
      });
      results.annual_payment_link = annualLink;
      console.log('Annual payment link:', annualLink?.url || annualLink);
    } catch (e) {
      console.error('Annual payment link creation failed:', e.message);
      results.annual_payment_link_error = e.message;
    }

    return res.status(200).json({
      success: true,
      ids: {
        product_id: productId,
        price_49_onetime_id: price49Id,
        price_297_recurring_id: price297Id,
        price_2997_yearly_id: price2997Id,
        trial_payment_link_url: trialLink?.url || null,
        annual_payment_link_url: annualLink?.url || null,
      },
      raw: results,
    });
  } catch (err) {
    console.error('Setup error:', err);
    return res.status(500).json({ error: 'Setup failed', message: err.message, results });
  }
}
