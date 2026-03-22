import { createClient } from '@supabase/supabase-js';
import { verifyEmail } from './lib/enrichment/email-verifier.js';
import { verifyPhone } from './lib/enrichment/phone-verifier.js';
import { analyzeDomain } from './lib/enrichment/domain-intel.js';
import { verifySocial } from './lib/enrichment/social-verifier.js';
import { calculateScore } from './lib/enrichment/confidence-scorer.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check — only allow internal calls
  const enrichKey = req.headers['x-enrich-key'];
  if (enrichKey !== process.env.ENRICH_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const errors = [];

  try {
    const { lead_id, lead_table, email, phone, website } = req.body;

    if (!lead_id || !lead_table || !email) {
      return res.status(400).json({ error: 'lead_id, lead_table, and email are required' });
    }

    // Determine domain for analysis
    let domain = null;
    if (website) {
      domain = website.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    } else if (email.includes('@')) {
      const emailDomain = email.split('@')[1].toLowerCase();
      // Skip common email providers — their websites aren't useful
      const skipDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'protonmail.com', 'proton.me', 'me.com', 'live.com', 'msn.com'];
      if (!skipDomains.includes(emailDomain)) {
        domain = emailDomain;
      }
    }

    // Run all enrichment modules in parallel
    const [emailResult, phoneResult, domainResult, socialResult] = await Promise.allSettled([
      verifyEmail(email).catch(err => { errors.push({ module: 'email', error: err.message }); return null; }),
      Promise.resolve(verifyPhone(phone)),
      analyzeDomain(domain).catch(err => { errors.push({ module: 'domain', error: err.message }); return null; }),
      verifySocial(email).catch(err => { errors.push({ module: 'social', error: err.message }); return null; }),
    ]);

    const emailData = emailResult.status === 'fulfilled' ? emailResult.value : null;
    const phoneData = phoneResult.status === 'fulfilled' ? phoneResult.value : null;
    const domainData = domainResult.status === 'fulfilled' ? domainResult.value : null;
    const socialData = socialResult.status === 'fulfilled' ? socialResult.value : null;

    // Calculate confidence score
    const { score, breakdown } = calculateScore({
      email: emailData,
      phone: phoneData,
      domain: domainData,
      social: socialData,
    });

    const enrichmentDuration = Date.now() - startTime;

    // Build the enrichment record
    const record = {
      lead_id,
      lead_table,
      email,

      // Email
      email_valid: emailData?.valid ?? null,
      email_mx_provider: emailData?.mx_provider ?? null,
      email_is_disposable: emailData?.is_disposable ?? null,
      email_is_catchall: emailData?.is_catchall ?? null,
      email_smtp_verified: emailData?.smtp_verified ?? null,

      // Phone
      phone_valid: phoneData?.valid ?? null,
      phone_type: phoneData?.type ?? null,
      phone_country: phoneData?.country ?? null,
      phone_formatted: phoneData?.formatted ?? null,

      // Domain
      domain: domain,
      domain_has_website: domainData?.has_website ?? null,
      domain_tech_stack: domainData?.tech_stack ?? {},
      domain_schema_org: domainData?.schema_org ?? {},
      domain_social_links: domainData?.social_links ?? {},
      domain_mx_provider: domainData?.mx_provider ?? null,
      domain_hosting_provider: domainData?.hosting_provider ?? null,

      // Social
      gravatar_exists: socialData?.gravatar_exists ?? null,
      gravatar_url: socialData?.gravatar_url ?? null,
      platforms_found: socialData?.platforms_found ?? [],

      // Scoring
      confidence_score: score,
      confidence_breakdown: breakdown,

      // Meta
      enriched_at: new Date().toISOString(),
      enrichment_duration_ms: enrichmentDuration,
      errors: errors.length > 0 ? errors : [],
    };

    // Upsert to Supabase (update if enrichment already exists for this lead)
    const { data, error } = await supabase
      .from('lead_enrichments')
      .upsert(record, { onConflict: 'lead_table,lead_id' })
      .select();

    if (error) {
      console.error('Supabase upsert error:', error);
      return res.status(500).json({ error: 'Failed to save enrichment', details: error.message });
    }

    console.log(`Enriched ${email} (${lead_table}/${lead_id}) — score: ${score}, duration: ${enrichmentDuration}ms`);

    return res.status(200).json({
      success: true,
      confidence_score: score,
      enrichment_duration_ms: enrichmentDuration,
      id: data?.[0]?.id,
    });
  } catch (err) {
    console.error('Enrichment error:', err);
    return res.status(500).json({ error: 'Enrichment failed', details: err.message });
  }
}
