// Handles Stripe webhook events (checkout.session.completed)
// Logs purchases to Supabase: trial_purchases + SimpleCRM (crm_contacts, crm_interactions, crm_tags)
// Configure webhook URL in Stripe dashboard: https://aisimple.co/api/stripe-webhook

import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

function verifyStripeSignature(payload, sig, secret) {
  if (!sig || !secret) return false;
  try {
    const elements = sig.split(',');
    const timestampEl = elements.find(e => e.startsWith('t='));
    const signatureEl = elements.find(e => e.startsWith('v1='));
    if (!timestampEl || !signatureEl) return false;

    const timestamp = timestampEl.split('=')[1];
    const signature = signatureEl.split('=')[1];
    const signedPayload = `${timestamp}.${payload}`;
    const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');

    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Verify signature if webhook secret is configured
    if (webhookSecret && !verifyStripeSignature(rawBody, sig, webhookSecret)) {
      console.error('Stripe webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const customerEmail = session.customer_details?.email || session.customer_email;
      const customerName = session.customer_details?.name || '';
      const amountTotal = session.amount_total;
      const currency = session.currency;

      let crmContactId = null;

      // --- SimpleCRM Integration ---

      if (customerEmail) {
        // 1. Find or create CRM contact
        const { data: existingContact } = await supabase
          .from('crm_contacts')
          .select('id')
          .eq('email', customerEmail)
          .limit(1)
          .single();

        if (existingContact) {
          // Update existing contact to customer status
          crmContactId = existingContact.id;
          await supabase
            .from('crm_contacts')
            .update({
              status: 'customer',
              last_contact_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', crmContactId);
        } else {
          // Create new CRM contact
          const { data: newContact } = await supabase
            .from('crm_contacts')
            .insert([{
              full_name: customerName || customerEmail.split('@')[0],
              email: customerEmail,
              status: 'customer',
              source: 'trial-page',
              source_detail: 'stripe-checkout',
              last_contact_date: new Date().toISOString(),
            }])
            .select('id')
            .single();

          if (newContact) {
            crmContactId = newContact.id;
          }
        }

        // 2. Log interaction in CRM
        if (crmContactId) {
          await supabase
            .from('crm_interactions')
            .insert([{
              contact_id: crmContactId,
              type: 'purchase',
              summary: `THE LAB 7-Day Trial — $${(amountTotal / 100).toFixed(2)} ${currency?.toUpperCase() || 'USD'}`,
              source_id: session.id,
              occurred_at: new Date().toISOString(),
            }]);

          // 3. Tag the contact
          await supabase
            .from('crm_tags')
            .insert([{
              contact_id: crmContactId,
              tag: 'the-lab-trial',
            }]);
        }
      }

      // --- Transaction Record ---

      const { error: purchaseError } = await supabase
        .from('trial_purchases')
        .insert([{
          email: customerEmail,
          name: customerName,
          stripe_session_id: session.id,
          stripe_customer_id: session.customer,
          stripe_payment_intent: session.payment_intent,
          amount: amountTotal,
          currency: currency,
          status: session.payment_status,
          source: 'trial-page',
          crm_contact_id: crmContactId,
        }]);

      if (purchaseError) {
        console.error('Failed to insert trial purchase:', purchaseError);
      }

      console.log('Trial purchase recorded:', customerEmail, `$${(amountTotal / 100).toFixed(2)}`, 'CRM contact:', crmContactId);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
