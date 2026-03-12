import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
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
      first_name,
      last_name,
      email,
      mobile,
      workshop,
      resources,
      microtraining,
      intro_to_andrew,
      source,
      page_url,
      user_agent
    } = req.body;

    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'First name, last name, and email are required' });
    }

    const { data, error } = await supabase
      .from('cre_leads')
      .insert([
        {
          first_name,
          last_name,
          email,
          mobile: mobile || null,
          workshop: workshop || false,
          resources: resources || false,
          microtraining: microtraining || false,
          intro_to_andrew: intro_to_andrew || false,
          source: source || 'cre-partnership',
          page_url: page_url || null,
          user_agent: user_agent || null,
        }
      ])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to save lead' });
    }

    // Send welcome email via Composio (must await or Vercel kills the function)
    try {
      const baseUrl = `https://${req.headers.host}`;
      const emailRes = await fetch(`${baseUrl}/api/send-cre-welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name, last_name, email }),
      });
      const emailResult = await emailRes.json();
      if (!emailRes.ok) {
        console.error('Welcome email failed:', JSON.stringify(emailResult));
      }
    } catch (emailErr) {
      console.error('Welcome email error:', emailErr);
    }

    return res.status(200).json({ success: true, id: data?.[0]?.id });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
