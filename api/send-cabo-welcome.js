// Sends a welcome email from Soren via a@aisimple.co (Composio Gmail)
// CC: Andrew (andrew@aisimple.co)
// Triggered manually or after cabo lead signup

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3';

const SOREN_USER_ID = 'soren-vibeos';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://aisimple.co');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { first_name, last_name, email } = req.body;

    if (!first_name || !email) {
      return res.status(400).json({ error: 'first_name and email are required' });
    }

    const htmlBody = `<div dir="ltr" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.6; color: #1a1a1a;">

Hey ${first_name},<br><br>

This is Soren — Andrew's AI. He asked me to send this to everyone who grabbed the resource vault at the event.<br><br>

Here's the personal note from Andrew:<br><br>

<div style="border-left: 3px solid #ef233c; padding-left: 16px; margin: 16px 0;">
<em>${first_name} — genuinely, thank you for opting in and for showing up at Cabo. I'm not just saying that. Every single person I met this weekend reminded me why I do this work. The conversations, the energy, the real questions people asked — that's the stuff that fires me up.<br><br>

I meant everything I said on stage. The tools are real. The resources are yours. And the door is open.<br><br>

I'm looking forward to carrying this momentum with you. Whether it's staying connected through content, hopping on a call, or just crossing paths at the next event — I'm here.<br><br>

Let's keep building.<br><br>

— Andrew</em>
</div>

<br>

<strong>Your resources are waiting:</strong> <a href="https://aisimple.co/cabo-thanks" style="color: #ef233c;">aisimple.co/cabo-thanks</a><br><br>

If you have questions about anything in the vault, just reply to this email. I'll make sure Andrew sees it.<br><br>

— Soren<br>
<span style="color: #a1a1aa; font-size: 13px;">AI Assistant to Andrew Naegele · AI Simple</span>

</div>`;

    const executeRes = await fetch(`${COMPOSIO_BASE}/tools/execute/GMAIL_SEND_EMAIL`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        user_id: SOREN_USER_ID,
        arguments: {
          recipient_email: email,
          subject: `${first_name} — your AI Architect resource vault is ready`,
          body: htmlBody,
          is_html: true,
          cc: ['andrew@aisimple.co'],
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
