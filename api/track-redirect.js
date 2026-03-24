import { createClient } from '@supabase/supabase-js';
import { parseUserAgent } from './lib/tracking/parse-user-agent.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  // 1. Extract slug from req.query.path (set by Vercel rewrite)
  const slug = req.query.path;

  // Guard: skip known non-shortlink paths
  if (!slug || slug.startsWith('api/') || slug.startsWith('img/') || slug.startsWith('css/') || slug === 'favicon.ico' || slug === 'robots.txt' || slug === 'sitemap.xml') {
    return res.status(404).json({ error: 'Not found' });
  }

  // 2. Look up shortlink
  const { data: shortlink, error } = await supabase
    .from('shortlinks')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !shortlink) {
    return res.status(404).send('<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>404 — Page Not Found</h1><p><a href="/">Go to aisimple.co</a></p></body></html>');
  }

  // 3. Extract tracking params (these get stripped — lead never sees them)
  const email = req.query.e || null;
  const source = req.query.src || null;
  const campaignId = req.query.cid || null;
  const messageId = req.query.mid || null;
  const contentType = req.query.t || null;
  const referrerPerson = req.query.ref || null;
  const utmSource = req.query.utm_source || null;
  const utmMedium = req.query.utm_medium || null;
  const utmCampaign = req.query.utm_campaign || null;
  const utmContent = req.query.utm_content || null;
  const utmTerm = req.query.utm_term || null;

  // 4. Extract geo from Vercel headers
  const city = req.headers['x-vercel-ip-city'] || null;
  const region = req.headers['x-vercel-ip-country-region'] || null;
  const country = req.headers['x-vercel-ip-country'] || null;

  // 5. Extract IP
  const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || null;

  // 6. Parse User-Agent
  const userAgent = req.headers['user-agent'] || null;
  const { device_type, os, browser } = parseUserAgent(userAgent);

  // 7. Check if first click (same email + slug)
  let isFirstClick = true;
  if (email) {
    const { count } = await supabase
      .from('link_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug)
      .eq('email', email);
    isFirstClick = (count || 0) === 0;
  }

  // 8. Look up contact_id if email is known
  let contactId = null;
  if (email) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', email)
      .limit(1)
      .single();
    if (contact) contactId = contact.id;
  }

  // 9. Log the click (await to ensure it completes before redirect)
  await supabase.from('link_clicks').insert({
    shortlink_id: shortlink.id,
    slug,
    email,
    source,
    campaign_id: campaignId,
    message_id: messageId,
    content_type: contentType,
    referrer_person: referrerPerson,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_content: utmContent,
    utm_term: utmTerm,
    ip_address: ipAddress,
    city,
    region,
    country,
    user_agent: userAgent,
    device_type,
    os,
    browser,
    referrer_url: req.headers['referer'] || null,
    is_first_click: isFirstClick,
    contact_id: contactId,
  });

  // 10. Fire PostHog event (fire-and-forget)
  if (process.env.POSTHOG_KEY) {
    fetch('https://us.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.POSTHOG_KEY,
        event: 'shortlink_clicked',
        distinct_id: email || ipAddress || 'anonymous',
        properties: {
          slug,
          destination: shortlink.destination_url,
          source,
          campaign_id: campaignId,
          is_first_click: isFirstClick,
          $ip: ipAddress,
          $browser: browser,
          $os: os,
          $device_type: device_type,
          $geoip_city_name: city,
          $geoip_country_code: country,
        },
      }),
    }).catch(() => {}); // fire and forget
  }

  // 11. Redirect (302 — don't cache)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Location', shortlink.destination_url);
  return res.status(302).end();
}
