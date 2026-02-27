// Sends a welcome email from Grace via Composio Gmail when a CRE lead signs up
// From: Grace (grace@leveragedcre.com via Composio)
// CC: Phill (ptomlinson@cpiaz.com)
// BCC: Andrew (andrew@aisimple.co)

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3';

// Grace's Composio connected account user_id
const GRACE_USER_ID = 'grace-leveragedcre';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { first_name, last_name, email } = req.body;

    if (!first_name || !email) {
      return res.status(400).json({ error: 'first_name and email are required' });
    }

    const fullName = `${first_name} ${last_name || ''}`.trim();

    const htmlBody = `
<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #3a3937;">
  <p style="font-size: 16px; line-height: 1.6;">Hi ${first_name},</p>

  <p style="font-size: 16px; line-height: 1.6;">Thank you so much for signing up at the CRE AI event! We're excited that you're interested in exploring how AI can transform your commercial real estate business.</p>

  <p style="font-size: 16px; line-height: 1.6;">We'll be in touch soon with the resources Phill mentioned, including details about the follow-up workshop and the AI workflows he's been using in his own CRE business.</p>

  <p style="font-size: 16px; line-height: 1.6;">In the meantime, keep an eye on your inbox -- Phill will be sending over some real examples and tools over the next few weeks.</p>

  <p style="font-size: 16px; line-height: 1.6;">If you have any questions at all, don't hesitate to reply to this email.</p>

  <p style="font-size: 16px; line-height: 1.6; margin-top: 24px;">
    Best,<br>
    <strong>Grace</strong><br>
    <span style="color: #5e8236;">LeveragedCRE</span>
  </p>
</div>`;

    // Execute GMAIL_SEND_EMAIL via Composio
    const executeRes = await fetch(`${COMPOSIO_BASE}/tools/execute/GMAIL_SEND_EMAIL`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        user_id: GRACE_USER_ID,
        input: {
          recipient_email: email,
          subject: `Welcome, ${first_name}! Your CRE AI Resources Are Coming`,
          body: htmlBody,
          is_html: true,
          cc: ['ptomlinson@cpiaz.com'],
          bcc: ['andrew@aisimple.co'],
          user_id: 'me',
        },
      }),
    });

    const result = await executeRes.json();

    if (!executeRes.ok) {
      console.error('Composio email error:', JSON.stringify(result));
      return res.status(500).json({ error: 'Failed to send welcome email', details: result });
    }

    return res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
