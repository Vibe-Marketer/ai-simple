import { createClient } from '@supabase/supabase-js';

async function sendEmail({ to, toName, subject, body, replyTo }) {
  try {
    const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
    const ANDREW_USER_ID = 'andrew-aisimple'; // Andrew's connected Gmail

    const res = await fetch('https://backend.composio.dev/api/v3/tools/execute/GMAIL_SEND_EMAIL', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        user_id: ANDREW_USER_ID,
        arguments: {
          recipient_email: to,
          recipient_name: toName,
          subject,
          body,
          reply_to: replyTo || 'andrew@aisimple.co',
        },
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('sendEmail error:', err);
    return false;
  }
}

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/<[^>]*>/g, '').substring(0, 1000);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://aisimple.co');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      name,
      email,
      phone,
      business,
      website,
      revenue,
      channel,
      help_wanted,
      investment_readiness,
      source,
      page_url,
      user_agent
    } = req.body;

    // Basic validation
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const safeName = sanitize(name);
    const safeEmail = sanitize(email);
    const safePhone = sanitize(phone);
    const safeBusiness = sanitize(business);
    const safeWebsite = sanitize(website);
    const safeRevenue = sanitize(revenue);
    const safeChannel = sanitize(channel);
    const safeHelpWanted = sanitize(help_wanted);
    const safeInvestmentReadiness = sanitize(investment_readiness);
    const safeSource = sanitize(source);
    const safePageUrl = sanitize(page_url);
    const safeUserAgent = sanitize(user_agent);

    const { data, error } = await supabase
      .from('leads')
      .insert([
        {
          name: safeName,
          email: safeEmail,
          phone: safePhone || null,
          business: safeBusiness || null,
          website: safeWebsite || null,
          revenue: safeRevenue || null,
          channel: safeChannel || null,
          help_wanted: safeHelpWanted || null,
          investment_readiness: safeInvestmentReadiness || null,
          qualified: false,
          source: safeSource || 'lead-magnet-page',
          page_url: safePageUrl || null,
          user_agent: safeUserAgent || null,
        }
      ])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to save lead' });
    }

    // Fire-and-forget emails (don't block response)
    const qualified = data?.[0]?.qualified;
    const leadName = safeName || name;
    const leadEmail = safeEmail || email;

    if (qualified) {
      // Notify Andrew of qualified lead
      sendEmail({
        to: 'andrew@aisimple.co',
        toName: 'Andrew',
        subject: `🔥 New Qualified Lead: ${leadName}`,
        body: `New qualified lead submitted:\n\nName: ${leadName}\nEmail: ${leadEmail}\nBusiness: ${business || 'N/A'}\nRevenue: ${revenue || 'N/A'}\nReadiness: ${req.body.investment_readiness || 'N/A'}\nChannel: ${channel || 'N/A'}\nWebsite: ${website || 'N/A'}\n\nView in Supabase: https://supabase.com/dashboard`,
      });

      // Welcome email to qualified lead
      sendEmail({
        to: leadEmail,
        toName: leadName,
        subject: `Your Strategy Call Application — Next Steps`,
        body: `Hey ${leadName.split(' ')[0]},\n\nJust got your application — you look like a strong fit.\n\nAndrew will review it personally and be in touch within 24 hours to confirm your call.\n\nIn the meantime, here's what to expect:\n• 45-minute strategy call (no pitch, just clarity)\n• We'll map out your exact AI implementation plan\n• You'll leave with a clear roadmap regardless of whether we work together\n\nIf you have any questions before the call, just reply to this email.\n\n— Andrew Naegele\nAI Simple\nhttps://aisimple.co`,
      });
    } else {
      // Nurture email for non-qualified leads
      sendEmail({
        to: leadEmail,
        toName: leadName,
        subject: `Your Free AI Resources from AI Simple`,
        body: `Hey ${leadName.split(' ')[0]},\n\nThanks for applying. Right now we're focused on done-for-you AI implementations for established businesses, so we're not the right fit just yet.\n\nBut that doesn't mean you can't start building — here's where to go next:\n\n→ Free Offer MBA + 728M Lead Vault: https://aisimple.co/mba\n→ THE LAB ($49/week): https://aisimple.co/trial\n→ Community: https://aisimple.co/community\n\nTHE LAB is the best place to start — you get every tool, automation, and workflow we build for 7-9 figure clients, plus weekly live calls with Andrew. $49 gets you 7 full days.\n\nHope to work with you soon.\n\n— Andrew Naegele\nAI Simple\nhttps://aisimple.co`,
      });
    }

    return res.status(200).json({ success: true, id: data?.[0]?.id });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
