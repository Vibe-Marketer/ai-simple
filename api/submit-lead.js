import { createClient } from '@supabase/supabase-js';

// Use service role key server-side to bypass RLS (safe — this only runs on Vercel, never exposed to browser)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
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
      source,
      page_url,
      user_agent
    } = req.body;

    // Basic validation
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const { data, error } = await supabase
      .from('leads')
      .insert([
        {
          name,
          email,
          phone: phone || null,
          business: business || null,
          website: website || null,
          revenue: revenue || null,
          channel: channel || null,
          help_wanted: help_wanted || null,
          source: source || 'lead-magnet-page',
          page_url: page_url || null,
          user_agent: user_agent || null,
        }
      ])
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to save lead' });
    }

    return res.status(200).json({ success: true, id: data?.[0]?.id });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
