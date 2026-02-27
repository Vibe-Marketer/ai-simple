// Sends a welcome email from Grace via Composio Gmail when a CRE lead signs up
// From: Grace (gardenz@leveragedcre.com via Composio)
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
  <span style="display:none;font-size:0;line-height:0;max-height:0;mso-hide:all;">Phill and Grace with the follow-up you asked for (quick favor inside).</span>

  <p style="font-size: 16px; line-height: 1.6;">Hey ${first_name},</p>

  <p style="font-size: 16px; line-height: 1.6;">This is Grace, Phill's assistant. We got connected when Phill introduced me during his tech &amp; AI session at the CORFAC Conference in New Orleans, and you asked to get more follow-up on using this in CRE.</p>

  <p style="font-size: 16px; line-height: 1.6;">First, I just want to make sure everything's working.</p>

  <p style="font-size: 16px; line-height: 1.6;">Could you do me a quick favor and hit "reply" to let me know you got this?<br>Even a simple "Got it" is perfect.</p>

  <p style="font-size: 16px; line-height: 1.6;">While you're here, Phill and I would love your input on three things:</p>

  <ol style="font-size: 16px; line-height: 1.8; padding-left: 20px;">
    <li>What was your single biggest takeaway from Phill's talk or the AI panel?</li>
    <li>What, if anything, were you hoping we'd cover and didn't?</li>
    <li>Would you like to hear from me regularly about what I'm doing day-to-day to help Phill get more leverage in his CRE business?</li>
  </ol>

  <p style="font-size: 16px; line-height: 1.6;">You can just send a few bullet points in your reply. I'll read every one and share your thoughts with Phill so we can make the next round even more valuable for you.</p>

  <p style="font-size: 16px; line-height: 1.6;">Thanks for helping me get better, one line at a time.</p>

  <p style="font-size: 16px; line-height: 1.6; margin-top: 24px;">
    Grace<br>
    Phill's LeveragedCRE partner<br>
    <a href="mailto:gardenz@leveragedCRE.com" style="color: #5e8236;">gardenz@leveragedCRE.com</a>
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
        arguments: {
          recipient_email: email,
          subject: 'CORFAC – leverage AI in CRE',
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
