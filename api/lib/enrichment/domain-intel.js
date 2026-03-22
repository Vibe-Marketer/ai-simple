import dns from 'dns';
import { load } from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SOCIAL_PATTERNS = [
  { pattern: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|company)\/[^\s"'<>]+/gi, platform: 'linkedin' },
  { pattern: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>]+/gi, platform: 'twitter' },
  { pattern: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[^\s"'<>]+/gi, platform: 'facebook' },
  { pattern: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s"'<>]+/gi, platform: 'instagram' },
  { pattern: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@|channel\/|c\/)[^\s"'<>]+/gi, platform: 'youtube' },
  { pattern: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[^\s"'<>]+/gi, platform: 'tiktok' },
  { pattern: /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s"'<>]+/gi, platform: 'github' },
];

const TECH_PATTERNS = [
  { pattern: /wp-content|wp-includes|wordpress/i, tech: 'wordpress' },
  { pattern: /shopify/i, tech: 'shopify' },
  { pattern: /_next\/|__next/i, tech: 'nextjs' },
  { pattern: /squarespace/i, tech: 'squarespace' },
  { pattern: /wix\.com/i, tech: 'wix' },
  { pattern: /webflow/i, tech: 'webflow' },
  { pattern: /framer/i, tech: 'framer' },
  { pattern: /ghost/i, tech: 'ghost' },
  { pattern: /hubspot/i, tech: 'hubspot' },
  { pattern: /kajabi/i, tech: 'kajabi' },
  { pattern: /clickfunnels/i, tech: 'clickfunnels' },
  { pattern: /kartra/i, tech: 'kartra' },
  { pattern: /react/i, tech: 'react' },
  { pattern: /vue/i, tech: 'vue' },
  { pattern: /angular/i, tech: 'angular' },
  { pattern: /gatsby/i, tech: 'gatsby' },
  { pattern: /astro/i, tech: 'astro' },
  { pattern: /svelte|sveltekit/i, tech: 'svelte' },
];

const NS_PROVIDER_MAP = [
  { pattern: /cloudflare/i, provider: 'cloudflare' },
  { pattern: /awsdns|amazonaws/i, provider: 'aws' },
  { pattern: /googledomains|google/i, provider: 'google' },
  { pattern: /digitalocean/i, provider: 'digitalocean' },
  { pattern: /godaddy|domaincontrol/i, provider: 'godaddy' },
  { pattern: /namecheap/i, provider: 'namecheap' },
  { pattern: /vercel-dns/i, provider: 'vercel' },
  { pattern: /netlify/i, provider: 'netlify' },
  { pattern: /squarespace/i, provider: 'squarespace' },
  { pattern: /wix/i, provider: 'wix' },
];

async function resolveNs(domain) {
  return new Promise((resolve) => {
    dns.resolveNs(domain, (err, addresses) => {
      if (err) return resolve(null);
      resolve(addresses);
    });
  });
}

function identifyHostingProvider(nsRecords) {
  if (!nsRecords) return null;
  for (const ns of nsRecords) {
    for (const { pattern, provider } of NS_PROVIDER_MAP) {
      if (pattern.test(ns)) return provider;
    }
  }
  return 'other';
}

function extractSocialLinks(html) {
  const links = {};
  for (const { pattern, platform } of SOCIAL_PATTERNS) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      // Deduplicate and take the first clean match
      const clean = matches[0].replace(/['"<>].*$/, '');
      if (!clean.endsWith('/search') && !clean.endsWith('/sharer')) {
        links[platform] = clean.startsWith('http') ? clean : `https://${clean}`;
      }
    }
  }
  return links;
}

function detectTechStack(html, headers) {
  const detected = {};

  // From HTML content
  for (const { pattern, tech } of TECH_PATTERNS) {
    if (pattern.test(html)) {
      detected[tech] = true;
    }
  }

  // From headers
  const poweredBy = headers?.['x-powered-by'];
  if (poweredBy) {
    detected[`x-powered-by: ${poweredBy}`] = true;
  }

  const server = headers?.['server'];
  if (server) {
    detected[`server: ${server}`] = true;
  }

  // Generator meta tag
  const generatorMatch = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
  if (generatorMatch) {
    detected[generatorMatch[1].toLowerCase()] = true;
  }

  return detected;
}

function extractSchemaOrg($) {
  const schemas = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).html();
      if (text) {
        const parsed = JSON.parse(text);
        schemas.push(parsed);
      }
    } catch {
      // Invalid JSON-LD — skip
    }
  });

  // Also extract Open Graph data
  const og = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property')?.replace('og:', '');
    const content = $(el).attr('content');
    if (prop && content) og[prop] = content;
  });

  if (Object.keys(og).length > 0) {
    schemas.push({ '@type': 'OpenGraph', ...og });
  }

  return schemas.length > 0 ? schemas : {};
}

export async function analyzeDomain(domain) {
  const result = {
    has_website: false,
    tech_stack: {},
    schema_org: {},
    social_links: {},
    mx_provider: null,
    hosting_provider: null,
  };

  if (!domain) return result;

  // Clean domain
  domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

  // DNS NS lookup (for hosting provider) — run in parallel with website fetch
  const [nsRecords, websiteResult] = await Promise.allSettled([
    resolveNs(domain),
    fetchWebsite(domain),
  ]);

  if (nsRecords.status === 'fulfilled' && nsRecords.value) {
    result.hosting_provider = identifyHostingProvider(nsRecords.value);
  }

  if (websiteResult.status === 'fulfilled' && websiteResult.value) {
    const { html, headers } = websiteResult.value;
    result.has_website = true;
    result.tech_stack = detectTechStack(html, headers);
    result.social_links = extractSocialLinks(html);

    try {
      const $ = load(html);
      result.schema_org = extractSchemaOrg($);
    } catch {
      // HTML parsing failed
    }
  }

  return result;
}

async function fetchWebsite(domain) {
  const urls = [`https://${domain}`, `http://${domain}`];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const html = await res.text();
        const headers = Object.fromEntries(res.headers.entries());
        return { html: html.substring(0, 500000), headers }; // Cap at 500KB
      }
    } catch {
      continue;
    }
  }

  return null;
}
