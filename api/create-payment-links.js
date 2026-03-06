// Creates Stripe Payment Links using the Stripe SDK directly.
// POST /api/create-payment-links (requires SETUP_SECRET auth)
// Run once to create payment links, then update checkout URLs in HTML pages.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.SETUP_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Trial payment link: $49 one-time + $297/28-day recurring with 7-day trial
    const trialLink = await stripe.paymentLinks.create({
      line_items: [
        { price: 'price_1T7ouHGj1WiXtQOW01ekbfZX', quantity: 1 },  // $49 one-time
        { price: 'price_1T7ouPGj1WiXtQOWM5QZ5j5z', quantity: 1 },  // $297/28-day recurring
      ],
      subscription_data: {
        trial_period_days: 7,
      },
      after_completion: {
        type: 'redirect',
        redirect: { url: 'https://aisimple.co/trial-upsell' },
      },
    });

    // Annual payment link: $2,997/year
    const annualLink = await stripe.paymentLinks.create({
      line_items: [
        { price: 'price_1T7ouVGj1WiXtQOWfKE3iJAL', quantity: 1 },  // $2,997/year
      ],
      after_completion: {
        type: 'redirect',
        redirect: { url: 'https://aisimple.co/welcome?plan=annual' },
      },
    });

    return res.status(200).json({
      success: true,
      trial: {
        id: trialLink.id,
        url: trialLink.url,
      },
      annual: {
        id: annualLink.id,
        url: annualLink.url,
      },
    });
  } catch (err) {
    console.error('Payment link creation error:', err);
    return res.status(500).json({ error: err.message });
  }
}
