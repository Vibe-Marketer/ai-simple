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

    const htmlBody = `<div dir="ltr">Hey ${first_name},<br><br>This is Grace, Phill's assistant. We got connected when Phill introduced me during his tech & AI session at the CORFAC Conference in New Orleans, and you asked to get more follow-up on using this in CRE.<br><br>First, I just want to make sure everything's working.<br><br>Could you do me a quick favor and hit "reply" to let me know you got this?<br>Even a simple "Got it" is perfect.<br><br>While you're here, Phill and I would love your input on three things:<br><br>1. What was your single biggest takeaway from the AI panel?<br>2. What were you hoping to learn more about with AI & CRE that we didn't cover?<br>3. Would you like to hear from me regularly about how we're using AI Employees to get more leverage?<br><br>You can just send a few bullet points in your reply. I'll read every one and share your thoughts with Phill so we can make the next round even more valuable for you.<br><br>Thanks for helping me get better, one line at a time.<br><br>Grace<br>Phill's LeveragedCRE partner<br>gardenz@leveragedCRE.com</div>`;

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
