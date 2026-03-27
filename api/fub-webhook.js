/**
 * FUB Webhook Handler
 *
 * Receives webhook events from Follow Up Boss when new leads are created
 * or existing contacts are updated. Triggers the enrichment pipeline
 * automatically for new contacts.
 *
 * Webhook Setup in FUB:
 *   URL: https://your-domain.com/api/fub-webhook
 *   Events: People Created, People Updated
 *
 * Environment Variables:
 *   FUB_WEBHOOK_SECRET — Webhook signing secret (optional, for verification)
 */

const { enrichContact } = require('../src/pipeline');
const fub = require('../src/fub/client');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;

    // Validate webhook payload
    if (!event || !event.event) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    console.log(`[FUB Webhook] Received event: ${event.event}`);

    // Optional: Verify webhook signature
    if (process.env.FUB_WEBHOOK_SECRET) {
      const signature = req.headers['x-fub-signature'];
      if (!verifySignature(JSON.stringify(event), signature, process.env.FUB_WEBHOOK_SECRET)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Handle different event types
    switch (event.event) {
      case 'peopleCreated':
      case 'people.created':
        await handleNewContact(event);
        break;

      case 'peopleUpdated':
      case 'people.updated':
        await handleUpdatedContact(event);
        break;

      default:
        console.log(`[FUB Webhook] Unhandled event type: ${event.event}`);
    }

    return res.status(200).json({ success: true, event: event.event });
  } catch (err) {
    console.error(`[FUB Webhook] Error: ${err.message}`);
    return res.status(500).json({ error: 'Webhook processing failed', details: err.message });
  }
};

async function handleNewContact(event) {
  const personId = event.personId || event.data?.id;
  if (!personId) {
    console.warn('[FUB Webhook] No personId in event');
    return;
  }

  console.log(`[FUB Webhook] New contact: ${personId}`);

  // Fetch the full contact from FUB
  const contact = await fub.getContact(personId);

  // Run enrichment pipeline (async, don't block the webhook response)
  enrichContact(contact, {
    pushToFub: true,
    listeningConfig: {
      targetAreas: (process.env.TARGET_AREAS || '').split(',').filter(Boolean),
      agentArea: process.env.AGENT_AREA || '',
    },
  }).then(result => {
    console.log(`[FUB Webhook] Enrichment complete for ${personId}: DISC=${result.profile?.disc?.primary}, signals=${result.signals.length}`);
  }).catch(err => {
    console.error(`[FUB Webhook] Enrichment failed for ${personId}: ${err.message}`);
  });
}

async function handleUpdatedContact(event) {
  // Only re-enrich if specific fields changed (e.g., email added)
  const personId = event.personId || event.data?.id;
  if (!personId) return;

  const changedFields = event.data?.changedFields || [];
  const triggerFields = ['emails', 'phones', 'firstName', 'lastName'];

  const shouldReenrich = changedFields.some(f => triggerFields.includes(f));
  if (!shouldReenrich) {
    console.log(`[FUB Webhook] Updated contact ${personId} — no trigger fields changed, skipping`);
    return;
  }

  console.log(`[FUB Webhook] Re-enriching updated contact: ${personId}`);
  const contact = await fub.getContact(personId);

  enrichContact(contact, { pushToFub: true }).catch(err => {
    console.error(`[FUB Webhook] Re-enrichment failed for ${personId}: ${err.message}`);
  });
}

function verifySignature(payload, signature, secret) {
  if (!signature) return false;
  const crypto = require('crypto');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
