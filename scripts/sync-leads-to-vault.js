#!/usr/bin/env node

// Syncs contacts from Supabase → vault/business/clients/_leads/ as markdown dossiers
// Primary source: unified contacts table + lead_enrichments for detailed data
// Run manually: node scripts/sync-leads-to-vault.js
// Runs automatically via launchd every 15 minutes

import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zwbytgsxixcbqrvdxgzv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const VAULT_LEADS_DIR = '/Users/Naegele/vault/business/clients/_leads';

if (!SUPABASE_KEY) {
  console.error('Set SUPABASE_SECRET_KEY env var');
  process.exit(1);
}

const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };

async function fetchContacts() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?select=*&order=created_at.desc`, { headers });
  return res.json();
}

async function fetchEnrichment(leadTable, leadId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/lead_enrichments?lead_table=eq.${leadTable}&lead_id=eq.${leadId}&select=*&limit=1`,
    { headers }
  );
  const data = await res.json();
  return data?.[0] || null;
}

function buildDossier(contact, enrichment) {
  const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
  const email = contact.email;
  const score = enrichment?.confidence_score ?? contact.confidence_score;
  const breakdown = enrichment?.confidence_breakdown || {};
  const domain = enrichment?.domain || contact.domain;
  const now = new Date().toISOString().split('T')[0];

  let tier = 'Low';
  if (score >= 60) tier = 'High';
  else if (score >= 40) tier = 'Medium';
  if (score == null) tier = 'Not scored';

  // Social links
  const socialLinks = enrichment?.domain_social_links || {};
  const socialSection = Object.entries(socialLinks)
    .map(([platform, url]) => `- **${platform}:** ${url}`)
    .join('\n') || '- None found on website';

  // Tech stack
  const techStack = Object.keys(enrichment?.domain_tech_stack || {});
  const techSection = techStack.length > 0 ? techStack.join(', ') : 'Not detected';

  // Schema.org description
  const schemaOrg = enrichment?.domain_schema_org;
  let companyDescription = '';
  if (Array.isArray(schemaOrg)) {
    for (const schema of schemaOrg) {
      if (schema.description) companyDescription = schema.description;
      if (schema['@type'] === 'OpenGraph' && schema.description) companyDescription = schema.description;
    }
  }

  // Gravatar/platforms
  const platforms = enrichment?.platforms_found || [];
  const platformSection = platforms.length > 0
    ? platforms.map(p => `- **${p.platform}:** ${p.url || p.username || 'found'}`).join('\n')
    : '- None found';

  const md = `---
type: lead-enrichment
person: "${name}"
email: "${email}"
domain: "${domain || 'N/A'}"
confidence-score: ${score ?? 'null'}
confidence-tier: "${tier}"
source: "${contact.source || 'unknown'}"
stage: "${contact.stage || 'new'}"
status: prospect
created: ${now}
tags: [lead, enrichment, ${contact.source || 'unknown'}]
---

# ${name}

## Quick Reference
- **Email:** ${email}
- **Email Provider:** ${enrichment?.email_mx_provider || contact.email_provider || 'unknown'}
- **Email Valid:** ${(enrichment?.email_valid ?? contact.email_valid) === true ? 'Yes' : (enrichment?.email_valid ?? contact.email_valid) === false ? 'No' : 'Unknown'}
- **Disposable Email:** ${enrichment?.email_is_disposable === true ? 'YES (flag)' : 'No'}
- **Phone:** ${enrichment?.phone_formatted || contact.phone || 'N/A'}
- **Phone Valid:** ${(enrichment?.phone_valid ?? contact.phone_valid) === true ? 'Yes' : 'Unknown'}
- **Phone Type:** ${enrichment?.phone_type || contact.phone_type || 'unknown'}
- **Phone Country:** ${enrichment?.phone_country || 'unknown'}
- **Domain:** ${domain || 'N/A'}
- **Website:** ${(enrichment?.domain_has_website ?? contact.domain_has_website) ? `https://${domain}` : 'No website found'}
- **Confidence Score:** ${score != null ? `${score}/100 (${tier})` : 'Not scored'}
- **Source:** ${contact.source || 'unknown'}
- **Stage:** ${contact.stage || 'new'}
- **Business:** ${contact.business || 'N/A'}
- **Revenue:** ${contact.revenue || 'N/A'}
- **Submitted:** ${contact.created_at ? new Date(contact.created_at).toISOString().split('T')[0] : now}

## Confidence Breakdown
${Object.entries(breakdown).map(([signal, points]) => `- **${signal.replace(/_/g, ' ')}:** +${points}`).join('\n') || '- No signals detected'}

## Domain Intelligence
- **Has Website:** ${(enrichment?.domain_has_website ?? contact.domain_has_website) ? 'Yes' : 'No'}
- **Hosting:** ${enrichment?.domain_hosting_provider || 'unknown'}
- **Tech Stack:** ${techSection}
${companyDescription ? `- **Description:** ${companyDescription}` : ''}

## Company Social Links (from their website, not verified as personal)
${socialSection}

## Digital Footprint
${platformSection}
${enrichment?.gravatar_exists ? `- **Gravatar:** ${enrichment.gravatar_url}` : '- No Gravatar found'}

## What They Want
${contact.help_wanted || contact.investment_readiness || 'Not specified in form submission'}

## Notes
Auto-generated from Supabase contacts table on ${now}.
${enrichment ? `Enrichment took ${enrichment.enrichment_duration_ms}ms.` : 'Not yet enriched.'}
${enrichment?.errors?.length > 0 ? `\nErrors during enrichment: ${JSON.stringify(enrichment.errors)}` : ''}

---
*To run a full OCEAN profile and communication playbook, use the enrich-contact skill.*
`;

  return md;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  if (!fs.existsSync(VAULT_LEADS_DIR)) {
    fs.mkdirSync(VAULT_LEADS_DIR, { recursive: true });
  }

  const contacts = await fetchContacts();
  console.log(`Found ${contacts.length} contacts in Supabase`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Deduplicate by name (keep first occurrence = most recent)
  const seen = new Set();

  for (const contact of contacts) {
    const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    if (!name || name === 'KeyRotation Test' || name === 'Andrew Naegele') {
      skipped++;
      continue;
    }

    if (seen.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    seen.add(name.toLowerCase());

    const slug = slugify(name);
    const filePath = path.join(VAULT_LEADS_DIR, `${slug}.md`);

    // Don't overwrite full OCEAN dossiers
    const exists = fs.existsSync(filePath);
    if (exists) {
      const existing = fs.readFileSync(filePath, 'utf8');
      if (existing.includes('type: relationship-intelligence')) {
        skipped++;
        continue;
      }
    }

    // Try to find enrichment data
    let enrichment = null;
    if (contact.original_table && contact.original_id) {
      enrichment = await fetchEnrichment(contact.original_table, contact.original_id);
    }
    // Also check if enrichment exists directly for contacts table
    if (!enrichment && contact.id) {
      enrichment = await fetchEnrichment('contacts', contact.id);
    }

    const dossier = buildDossier(contact, enrichment);
    fs.writeFileSync(filePath, dossier);

    if (exists) {
      console.log(`  Updated: ${filePath}`);
      updated++;
    } else {
      console.log(`  Created: ${filePath}`);
      created++;
    }
  }

  console.log(`\nDone: ${created} created, ${updated} updated, ${skipped} skipped`);
}

main().catch(console.error);
