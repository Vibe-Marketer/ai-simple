// Handles Calendly webhook events
// Register at: https://calendly.com/integrations/webhooks
// Events to subscribe: invitee.created, invitee.canceled
// Webhook URL: https://aisimple.co/api/calendly-webhook

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;
    const eventType = event?.event; // 'invitee.created' or 'invitee.canceled'
    const payload = event?.payload;

    if (!eventType || !payload) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const invitee = payload.invitee || {};
    const eventData = payload.event || {};

    const bookingData = {
      event_type: eventType,
      invitee_name: invitee.name || null,
      invitee_email: invitee.email || null,
      event_start_time: eventData.start_time || null,
      event_end_time: eventData.end_time || null,
      calendly_event_uri: eventData.uri || null,
      calendly_invitee_uri: invitee.uri || null,
      utm_source: payload.tracking?.utm_source || null,
      utm_medium: payload.tracking?.utm_medium || null,
      utm_campaign: payload.tracking?.utm_campaign || null,
      cancel_reason: payload.cancel_reason || null,
      status: eventType === 'invitee.created' ? 'booked' : 'canceled',
      created_at: new Date().toISOString(),
    };

    // Upsert into bookings table (create if not exists via migration)
    const { error } = await supabase
      .from('strategy_call_bookings')
      .upsert([bookingData], { onConflict: 'calendly_invitee_uri' });

    if (error) {
      console.error('Supabase booking insert error:', error);
      // Don't return error to Calendly — just log it
    }

    // Also update CRM contact if email matches an existing lead
    if (invitee.email && eventType === 'invitee.created') {
      await supabase
        .from('leads')
        .update({
          calendly_booked: true,
          calendly_booked_at: new Date().toISOString()
        })
        .eq('email', invitee.email);

      // Notify Andrew
      try {
        await fetch('https://backend.composio.dev/api/v3/tools/execute/GMAIL_SEND_EMAIL', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.COMPOSIO_API_KEY,
          },
          body: JSON.stringify({
            user_id: 'andrew-aisimple',
            arguments: {
              recipient_email: 'andrew@aisimple.co',
              recipient_name: 'Andrew',
              subject: `📅 Strategy Call Booked: ${invitee.name}`,
              body: `New strategy call booked!\n\nName: ${invitee.name}\nEmail: ${invitee.email}\nTime: ${eventData.start_time}\n\nCalendly: ${invitee.uri}`,
            },
          }),
        });
      } catch (emailErr) {
        console.error('Notification email error:', emailErr);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Calendly webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
