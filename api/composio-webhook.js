// Handles Composio trigger webhooks (Stripe checkout completed, payment failed, etc.)
// Composio delivers trigger events here when subscribed events fire.
// Logs purchases to Supabase: trial_purchases + SimpleCRM

import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

function verifyComposioSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  try {
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
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
    const secret = process.env.COMPOSIO_WEBHOOK_SECRET;
    const signature = req.headers['x-composio-signature'] || req.headers['x-webhook-signature'];

    if (secret && signature && !verifyComposioSignature(rawBody, signature, secret)) {
      console.error('Composio webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody);
    const triggerSlug = event.trigger_slug || event.triggerName || '';
    const payload = event.payload || event.body || event;

    console.log('Composio trigger received:', triggerSlug);

    if (triggerSlug === 'STRIPE_CHECKOUT_SESSION_COMPLETED_TRIGGER') {
      const stripeEvent = payload.body || payload;
      const session = stripeEvent.data?.object || stripeEvent;

      const customerEmail = session.customer_details?.email || session.customer_email;
      const customerName = session.customer_details?.name || '';
      const amountTotal = session.amount_total;
      const currency = session.currency;

      let crmContactId = null;

      if (customerEmail) {
        // Find or create CRM contact
        const { data: existingContact } = await supabase
          .from('crm_contacts')
          .select('id')
          .eq('email', customerEmail)
          .limit(1)
          .single();

        if (existingContact) {
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
          const { data: newContact } = await supabase
            .from('crm_contacts')
            .insert([{
              full_name: customerName || customerEmail.split('@')[0],
              email: customerEmail,
              status: 'customer',
              source: 'trial-page',
              source_detail: 'composio-stripe-trigger',
              last_contact_date: new Date().toISOString(),
            }])
            .select('id')
            .single();

          if (newContact) crmContactId = newContact.id;
        }

        // Log interaction
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

          await supabase
            .from('crm_tags')
            .insert([{
              contact_id: crmContactId,
              tag: 'the-lab-trial',
            }]);
        }
      }

      // Record the purchase
      await supabase
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

      console.log('Trial purchase via Composio:', customerEmail, `$${(amountTotal / 100).toFixed(2)}`);
    }

    if (triggerSlug === 'STRIPE_PAYMENT_FAILED_TRIGGER') {
      const stripeEvent = payload.body || payload;
      const intent = stripeEvent.data?.object || stripeEvent;
      console.log('Payment failed:', intent.id, intent.last_payment_error?.message);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Composio webhook error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
