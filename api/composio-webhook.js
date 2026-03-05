// Handles Composio trigger webhooks (Stripe checkout completed, payment failed, etc.)
// Composio delivers trigger events here when subscribed events fire.
// Logs purchases to Supabase: trial_purchases + SimpleCRM
// Post-purchase: welcome email, Drive sharing, Andrew notifications

import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3';

// --- Composio tool execution helper ---

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

// --- Post-purchase automation actions ---

async function sendBuyerWelcomeEmail(email, name) {
  const firstName = name ? name.split(' ')[0] : 'there';
  return executeComposioTool(
    'RESEND_SEND_EMAIL',
    process.env.COMPOSIO_RESEND_USER_ID,
    {
      from: 'Andrew <a@mail.aisimple.co>',
      reply_to: 'a@aisimple.co',
      to: email,
      subject: "You're in — welcome to THE LAB",
      html: `<p>Hey ${firstName},</p>
<p>You're officially in THE LAB. Here's everything you need to get started:</p>
<p><strong>1. Join the WhatsApp group:</strong><br/>
<a href="https://chat.whatsapp.com/JNKkecBPQTEKfNElHJMtIV">Click here to join</a> — this is where the real conversations happen.</p>
<p><strong>2. Access the resource vault:</strong><br/>
A Google Drive folder with tools, templates, and automations has been shared with your email (${email}). Check your Drive for it.</p>
<p><strong>3. Your 7-day trial starts now.</strong><br/>
Dive in, ask questions, build things. This is your backstage pass.</p>
<p>Talk soon,<br/>Andrew</p>`,
    }
  );
}

async function shareGoogleDriveFolder(email) {
  return executeComposioTool(
    'GOOGLEDRIVE_ADD_FILE_SHARING_PREFERENCE',
    process.env.COMPOSIO_GOOGLEDRIVE_USER_ID,
    {
      file_id: '1ytVubbMbkoIv9o0-RfhYSZeGuINY-1Nb',
      email_address: email,
      role: 'reader',
      type: 'user',
    }
  );
}

async function sendAndrewNotificationEmail(email, name, amount) {
  return executeComposioTool(
    'RESEND_SEND_EMAIL',
    process.env.COMPOSIO_RESEND_USER_ID,
    {
      from: 'THE LAB <a@aisimple.co>',
      to: 'a@aisimple.co',
      subject: `New LAB trial purchase — ${name || email}`,
      html: `<p><strong>New trial purchase:</strong></p>
<ul>
<li>Name: ${name || 'N/A'}</li>
<li>Email: ${email}</li>
<li>Amount: $${(amount / 100).toFixed(2)}</li>
</ul>
<p>Drive folder shared + welcome email sent automatically.</p>`,
    }
  );
}

async function sendAndrewWhatsAppNotification(email, name, amount) {
  const msg = `New LAB trial: ${name || email} — $${(amount / 100).toFixed(2)}`;
  return executeComposioTool(
    'WHATSAPP_SEND_MESSAGE',
    process.env.COMPOSIO_WHATSAPP_USER_ID,
    {
      phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
      to_number: process.env.ANDREW_WHATSAPP_NUMBER,
      text: msg,
    }
  );
}

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

      // --- Post-purchase automation (all fire in parallel, none blocks another) ---
      if (customerEmail) {
        const results = await Promise.allSettled([
          sendBuyerWelcomeEmail(customerEmail, customerName),
          shareGoogleDriveFolder(customerEmail),
          sendAndrewNotificationEmail(customerEmail, customerName, amountTotal),
          sendAndrewWhatsAppNotification(customerEmail, customerName, amountTotal),
        ]);

        const labels = ['welcome-email', 'drive-share', 'andrew-email', 'andrew-whatsapp'];
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            console.log(`Post-purchase [${labels[i]}]: OK`, JSON.stringify(r.value).slice(0, 200));
          } else {
            console.error(`Post-purchase [${labels[i]}]: FAILED`, r.reason);
          }
        });
      }

      // --- Annual upgrade: cancel monthly subscription + tag + welcome email ---
      const subscriptionId = session.subscription;
      if (subscriptionId) {
        try {
          // Retrieve subscription to check the price
          const subResult = await executeComposioTool(
            'STRIPE_RETRIEVE_SUBSCRIPTION',
            process.env.COMPOSIO_STRIPE_USER_ID,
            { subscription_id: subscriptionId }
          );
          const sub = subResult?.response_data || subResult?.data || {};
          const priceId = sub.items?.data?.[0]?.price?.id;
          const annualPriceId = process.env.STRIPE_ANNUAL_PRICE_ID;

          if (annualPriceId && priceId === annualPriceId) {
            console.log('Annual upgrade detected for:', customerEmail);

            // Find and cancel existing monthly subscription
            const custId = session.customer;
            if (custId) {
              const listResult = await executeComposioTool(
                'STRIPE_LIST_SUBSCRIPTIONS',
                process.env.COMPOSIO_STRIPE_USER_ID,
                { customer: custId, status: 'active' }
              );
              const subs = listResult?.response_data?.data || listResult?.data?.data || [];
              for (const existingSub of subs) {
                if (existingSub.id !== subscriptionId) {
                  await executeComposioTool(
                    'STRIPE_CANCEL_SUBSCRIPTION',
                    process.env.COMPOSIO_STRIPE_USER_ID,
                    { subscription_id: existingSub.id }
                  );
                  console.log('Cancelled monthly subscription:', existingSub.id);
                }
              }
            }

            // Tag CRM contact as founder-annual
            if (crmContactId) {
              await supabase.from('crm_tags').insert([{
                contact_id: crmContactId,
                tag: 'founder-annual',
              }]);
            }

            // Send Founder Annual welcome email
            if (customerEmail) {
              const firstName = customerName ? customerName.split(' ')[0] : 'there';
              await executeComposioTool(
                'RESEND_SEND_EMAIL',
                process.env.COMPOSIO_RESEND_USER_ID,
                {
                  from: 'Andrew <a@mail.aisimple.co>',
                  reply_to: 'a@aisimple.co',
                  to: customerEmail,
                  subject: "You're a Founder Annual member — let's build your Godfather Offer",
                  html: `<p>Hey ${firstName},</p>
<p>Welcome to Founder Annual. You've locked in the best rate and unlocked two 1:1 bonuses:</p>
<p><strong>1. Golden Thread Session</strong> — I'll extract your origin story, your why, and the positioning that makes your brand impossible to ignore.</p>
<p><strong>2. OfferMBA — Godfather Offer Build</strong> — I research your market, dissect your competitors, and build a Godfather Offer so good your audience can't say no.</p>
<p><strong>Book your first session:</strong><br/>
<a href="https://calendly.com/andrewnaegele/golden-thread">Click here to book your Golden Thread call</a></p>
<p>Talk soon,<br/>Andrew</p>`,
                }
              );
              console.log('Founder Annual welcome email sent to:', customerEmail);
            }
          }
        } catch (annualErr) {
          console.error('Annual upgrade processing error:', annualErr);
        }
      }
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
