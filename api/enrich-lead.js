import { createClient } from '@supabase/supabase-js';
import dns from 'dns';
import net from 'net';
import crypto from 'crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import * as cheerio from 'cheerio';
import disposableDomains from 'disposable-email-domains';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// ─── EMAIL VERIFICATION ────────────────────────────────────────────────────────

const disposableSet = new Set(disposableDomains);

const MX_PROVIDER_MAP = [
  { pattern: /google|gmail|googlemail/i, provider: 'google' },
  { pattern: /outlook|microsoft|hotmail|office365/i, provider: 'microsoft' },
  { pattern: /proton/i, provider: 'protonmail' },
  { pattern: /zoho/i, provider: 'zoho' },
  { pattern: /yahoodns|yahoo/i, provider: 'yahoo' },
  { pattern: /icloud|apple/i, provider: 'apple' },
  { pattern: /mimecast/i, provider: 'mimecast' },
  { pattern: /pphosted|proofpoint/i, provider: 'proofpoint' },
];

function identifyMxProvider(mxRecords) {
  if (!mxRecords || mxRecords.length === 0) return null;
  const primary = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;
  for (const { pattern, provider } of MX_PROVIDER_MAP) {
    if (pattern.test(primary)) return provider;
  }
  return 'custom';
}

function resolveMx(domain) {
  return new Promise((resolve) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err) return resolve(null);
      resolve(addresses);
    });
  });
}

function smtpVerify(mxHost, email, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let step = 'connect';
    let buffer = '';
    let resolved = false;

    const done = (result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => done(null), timeoutMs);

    socket.connect(25, mxHost, () => { step = 'greeting'; });

    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\r\n');
      const lastComplete = lines[lines.length - 2] || '';

      if (step === 'greeting' && /^220/.test(lastComplete)) {
        step = 'ehlo'; buffer = '';
        socket.write('EHLO verify.aisimple.co\r\n');
      } else if (step === 'ehlo' && /^250/.test(lastComplete)) {
        step = 'mailfrom'; buffer = '';
        socket.write('MAIL FROM:<verify@aisimple.co>\r\n');
      } else if (step === 'mailfrom' && /^250/.test(lastComplete)) {
        step = 'rcptto'; buffer = '';
        socket.write(`RCPT TO:<${email}>\r\n`);
      } else if (step === 'rcptto') {
        if (/^250|^251/.test(lastComplete)) done({ accepted: true, code: parseInt(lastComplete) });
        else if (/^5\d\d/.test(lastComplete)) done({ accepted: false, code: parseInt(lastComplete) });
      }
    });

    socket.on('error', () => done(null));
    socket.on('timeout', () => done(null));
    socket.setTimeout(timeoutMs);
  });
}

async function verifyEmail(email) {
  const result = { valid: null, mx_provider: null, is_disposable: false, is_catchall: null, smtp_verified: null };

  if (!email || !email.includes('@')) { result.valid = false; return result; }

  const domain = email.split('@')[1].toLowerCase();
  result.is_disposable = disposableSet.has(domain);

  const mxRecords = await resolveMx(domain);
  if (!mxRecords || mxRecords.length === 0) { result.valid = false; return result; }

  result.valid = true;
  result.mx_provider = identifyMxProvider(mxRecords);

  const primaryMx = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;
  try {
    const smtpResult = await smtpVerify(primaryMx, email);
    if (smtpResult) {
      result.smtp_verified = smtpResult.accepted;
      if (smtpResult.accepted) {
        const fakeEmail = `xyzcheck${Date.now()}@${domain}`;
        const catchAllResult = await smtpVerify(primaryMx, fakeEmail);
        result.is_catchall = catchAllResult?.accepted === true;
      }
    }
  } catch { /* SMTP failed — leave as null */ }

  return result;
}

// ─── PHONE VERIFICATION ────────────────────────────────────────────────────────

function verifyPhone(phone) {
  const result = { valid: false, type: null, country: null, formatted: null };
  if (!phone) return result;

  let cleaned = phone.toString().trim();
  if (/^\d{10,15}$/.test(cleaned) && cleaned.length > 10) cleaned = '+' + cleaned;

  const parsed = parsePhoneNumberFromString(cleaned, 'US');
  if (!parsed) return result;

  result.valid = parsed.isValid();
  result.formatted = parsed.format('E.164');
  result.country = parsed.country || null;

  const type = parsed.getType();
  if (type) {
    const typeMap = { 'MOBILE': 'mobile', 'FIXED_LINE': 'fixed_line', 'FIXED_LINE_OR_MOBILE': 'mobile_or_fixed', 'VOIP': 'voip', 'TOLL_FREE': 'toll_free' };
    result.type = typeMap[type] || type.toLowerCase();
  }

  return result;
}

// ─── DOMAIN INTELLIGENCE ────────────────────────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SOCIAL_PATTERNS = [
  { pattern: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|company)\/[^\s"'<>]+/gi, platform: 'linkedin' },
  { pattern: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>]+/gi, platform: 'twitter' },
  { pattern: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^\s"'<>]+/gi, platform: 'facebook' },
  { pattern: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s"'<>]+/gi, platform: 'instagram' },
  { pattern: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@|channel\/|c\/)[^\s"'<>]+/gi, platform: 'youtube' },
  { pattern: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[^\s"'<>]+/gi, platform: 'tiktok' },
];

const TECH_PATTERNS = [
  { pattern: /wp-content|wp-includes|wordpress/i, tech: 'wordpress' },
  { pattern: /shopify/i, tech: 'shopify' },
  { pattern: /_next\/|__next/i, tech: 'nextjs' },
  { pattern: /squarespace/i, tech: 'squarespace' },
  { pattern: /wix\.com/i, tech: 'wix' },
  { pattern: /webflow/i, tech: 'webflow' },
  { pattern: /framer/i, tech: 'framer' },
  { pattern: /hubspot/i, tech: 'hubspot' },
  { pattern: /kajabi/i, tech: 'kajabi' },
  { pattern: /clickfunnels/i, tech: 'clickfunnels' },
];

const NS_PROVIDER_MAP = [
  { pattern: /cloudflare/i, provider: 'cloudflare' },
  { pattern: /awsdns|amazonaws/i, provider: 'aws' },
  { pattern: /googledomains|google/i, provider: 'google' },
  { pattern: /godaddy|domaincontrol/i, provider: 'godaddy' },
  { pattern: /vercel-dns/i, provider: 'vercel' },
  { pattern: /netlify/i, provider: 'netlify' },
  { pattern: /squarespace/i, provider: 'squarespace' },
  { pattern: /wix/i, provider: 'wix' },
];

function resolveNs(domain) {
  return new Promise((resolve) => {
    dns.resolveNs(domain, (err, addresses) => {
      if (err) return resolve(null);
      resolve(addresses);
    });
  });
}

async function analyzeDomain(domain) {
  const result = { has_website: false, tech_stack: {}, schema_org: {}, social_links: {}, mx_provider: null, hosting_provider: null };
  if (!domain) return result;

  domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

  const [nsResult, webResult] = await Promise.allSettled([
    resolveNs(domain),
    fetchWebsite(domain),
  ]);

  if (nsResult.status === 'fulfilled' && nsResult.value) {
    for (const ns of nsResult.value) {
      for (const { pattern, provider } of NS_PROVIDER_MAP) {
        if (pattern.test(ns)) { result.hosting_provider = provider; break; }
      }
      if (result.hosting_provider) break;
    }
    if (!result.hosting_provider) result.hosting_provider = 'other';
  }

  if (webResult.status === 'fulfilled' && webResult.value) {
    const { html, headers } = webResult.value;
    result.has_website = true;

    // Tech stack
    for (const { pattern, tech } of TECH_PATTERNS) {
      if (pattern.test(html)) result.tech_stack[tech] = true;
    }
    if (headers?.['x-powered-by']) result.tech_stack[`x-powered-by: ${headers['x-powered-by']}`] = true;
    if (headers?.['server']) result.tech_stack[`server: ${headers['server']}`] = true;

    // Social links
    for (const { pattern, platform } of SOCIAL_PATTERNS) {
      const matches = html.match(pattern);
      if (matches?.[0]) {
        const clean = matches[0].replace(/['"<>].*$/, '');
        if (!clean.endsWith('/search') && !clean.endsWith('/sharer')) {
          result.social_links[platform] = clean.startsWith('http') ? clean : `https://${clean}`;
        }
      }
    }

    // Schema.org
    try {
      const $ = cheerio.load(html);
      const schemas = [];
      $('script[type="application/ld+json"]').each((_, el) => {
        try { schemas.push(JSON.parse($(el).html())); } catch {}
      });
      const og = {};
      $('meta[property^="og:"]').each((_, el) => {
        const prop = $(el).attr('property')?.replace('og:', '');
        const content = $(el).attr('content');
        if (prop && content) og[prop] = content;
      });
      if (Object.keys(og).length > 0) schemas.push({ '@type': 'OpenGraph', ...og });
      if (schemas.length > 0) result.schema_org = schemas;
    } catch {}
  }

  return result;
}

async function fetchWebsite(domain) {
  for (const proto of ['https', 'http']) {
    try {
      const res = await fetch(`${proto}://${domain}`, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const html = await res.text();
        return { html: html.substring(0, 500000), headers: Object.fromEntries(res.headers.entries()) };
      }
    } catch { continue; }
  }
  return null;
}

// ─── SOCIAL VERIFICATION ────────────────────────────────────────────────────────

async function verifySocial(email) {
  const result = { gravatar_exists: false, gravatar_url: null, platforms_found: [] };
  if (!email) return result;

  const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');

  try {
    const avatarRes = await fetch(`https://gravatar.com/avatar/${hash}?d=404`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    });

    if (avatarRes.ok) {
      result.gravatar_exists = true;
      result.gravatar_url = `https://gravatar.com/avatar/${hash}`;

      try {
        const profileRes = await fetch(`https://gravatar.com/${hash}.json`, { signal: AbortSignal.timeout(3000) });
        if (profileRes.ok) {
          const data = await profileRes.json();
          const entry = data?.entry?.[0];
          if (entry?.accounts) {
            for (const account of entry.accounts) {
              result.platforms_found.push({ platform: account.shortname || account.domain, url: account.url, source: 'gravatar_profile' });
            }
          }
          if (entry?.urls) {
            for (const url of entry.urls) {
              result.platforms_found.push({ platform: url.title || 'website', url: url.value, source: 'gravatar_profile' });
            }
          }
        }
      } catch {}
    }
  } catch {}

  return result;
}

// ─── CONFIDENCE SCORER ──────────────────────────────────────────────────────────

function calculateScore({ email, phone, domain, social }) {
  const breakdown = {};
  let score = 0;

  if (email?.valid === true) { breakdown.email_mx_exists = 15; score += 15; }
  if (email?.is_disposable === false) { breakdown.email_not_disposable = 10; score += 10; }
  if (email?.smtp_verified === true) { breakdown.email_smtp_verified = 10; score += 10; }
  if (email?.is_catchall === false) { breakdown.email_not_catchall = 5; score += 5; }

  if (phone?.valid === true) { breakdown.phone_valid = 10; score += 10; }
  if (phone?.type === 'mobile') { breakdown.phone_is_mobile = 5; score += 5; }

  if (domain?.has_website === true) { breakdown.domain_has_website = 15; score += 15; }
  if (domain?.schema_org && Object.keys(domain.schema_org).length > 0) {
    breakdown.schema_org_found = 5; score += 5;
    const schemaStr = JSON.stringify(domain.schema_org).toLowerCase();
    if (schemaStr.includes('organization') || schemaStr.includes('localbusiness') || schemaStr.includes('corporation')) {
      breakdown.business_schema = 10; score += 10;
    }
  }
  if (domain?.social_links && Object.keys(domain.social_links).length > 0) { breakdown.social_links_on_site = 5; score += 5; }
  if (domain?.tech_stack && Object.keys(domain.tech_stack).length > 0) { breakdown.tech_stack_detected = 5; score += 5; }

  if (social?.gravatar_exists === true) { breakdown.gravatar_exists = 5; score += 5; }

  return { score: Math.min(score, 100), breakdown };
}

// ─── MAIN HANDLER ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    let domain = null;
    if (website) {
      domain = website.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    } else if (email.includes('@')) {
      const emailDomain = email.split('@')[1].toLowerCase();
      const skipDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'protonmail.com', 'proton.me', 'me.com', 'live.com', 'msn.com'];
      if (!skipDomains.includes(emailDomain)) domain = emailDomain;
    }

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

    const { score, breakdown } = calculateScore({ email: emailData, phone: phoneData, domain: domainData, social: socialData });
    const enrichmentDuration = Date.now() - startTime;

    const record = {
      lead_id, lead_table, email,
      email_valid: emailData?.valid ?? null,
      email_mx_provider: emailData?.mx_provider ?? null,
      email_is_disposable: emailData?.is_disposable ?? null,
      email_is_catchall: emailData?.is_catchall ?? null,
      email_smtp_verified: emailData?.smtp_verified ?? null,
      phone_valid: phoneData?.valid ?? null,
      phone_type: phoneData?.type ?? null,
      phone_country: phoneData?.country ?? null,
      phone_formatted: phoneData?.formatted ?? null,
      domain,
      domain_has_website: domainData?.has_website ?? null,
      domain_tech_stack: domainData?.tech_stack ?? {},
      domain_schema_org: domainData?.schema_org ?? {},
      domain_social_links: domainData?.social_links ?? {},
      domain_mx_provider: domainData?.mx_provider ?? null,
      domain_hosting_provider: domainData?.hosting_provider ?? null,
      gravatar_exists: socialData?.gravatar_exists ?? null,
      gravatar_url: socialData?.gravatar_url ?? null,
      platforms_found: socialData?.platforms_found ?? [],
      confidence_score: score,
      confidence_breakdown: breakdown,
      enriched_at: new Date().toISOString(),
      enrichment_duration_ms: enrichmentDuration,
      errors: errors.length > 0 ? errors : [],
    };

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
