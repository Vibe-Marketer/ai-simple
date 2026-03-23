#!/usr/bin/env node

// Syncs lead_enrichments from Supabase → vault/business/clients/_leads/ as markdown dossiers
// Run manually: node scripts/sync-leads-to-vault.js
// Run on cron:  */5 * * * * cd /path/to/website-aisimple && node scripts/sync-leads-to-vault.js

import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zwbytgsxixcbqrvdxgzv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const VAULT_LEADS_DIR = '/Users/Naegele/vault/business/clients/_leads';

if (!SUPABASE_KEY) {
  console.error('Set SUPABASE_SECRET_KEY env var');
  process.exit(1);
}

async function fetchEnrichments() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/lead_enrichments?select=*&order=enriched_at.desc`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
}

async function fetchLead(table, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=*`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  const data = await res.json();
  return data?.[0] || null;
}

function buildDossier(lead, enrichment) {
  const name = lead.name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
  const firstName = lead.first_name || name.split(' ')[0];
  const lastName = lead.last_name || name.split(' ').slice(1).join(' ');
  const email = enrichment.email;
  const domain = enrichment.domain;
  const score = enrichment.confidence_score;
  const breakdown = enrichment.confidence_breakdown || {};
  const now = new Date().toISOString().split('T')[0];

  // Build social links section
  const socialLinks = enrichment.domain_social_links || {};
  const socialSection = Object.entries(socialLinks)
    .map(([platform, url]) => `- **${platform}:** ${url}`)
    .join('\n') || '- None found on website';

  // Build tech stack
  const techStack = Object.keys(enrichment.domain_tech_stack || {});
  const techSection = techStack.length > 0 ? techStack.join(', ') : 'Not detected';

  // Schema.org data
  const schemaOrg = enrichment.domain_schema_org;
  let companyDescription = '';
  if (Array.isArray(schemaOrg)) {
    for (const schema of schemaOrg) {
      if (schema.description) companyDescription = schema.description;
      if (schema['@type'] === 'OpenGraph' && schema.description) companyDescription = schema.description;
    }
  }

  // Platforms from Gravatar
  const platforms = enrichment.platforms_found || [];
  const platformSection = platforms.length > 0
    ? platforms.map(p => `- **${p.platform}:** ${p.url || p.username || 'found'}`).join('\n')
    : '- None found';

  // Confidence tier
  let tier = 'Low';
  if (score >= 60) tier = 'High';
  else if (score >= 40) tier = 'Medium';

  const md = `---
type: lead-enrichment
person: "${name}"
email: "${email}"
domain: "${domain || 'N/A'}"
confidence-score: ${score}
confidence-tier: "${tier}"
lead-source: "${enrichment.lead_table}"
status: prospect
created: ${now}
tags: [lead, enrichment, ${enrichment.lead_table}]
---

# ${name}

## Quick Reference
- **Email:** ${email}
- **Email Provider:** ${enrichment.email_mx_provider || 'unknown'}
- **Email Valid:** ${enrichment.email_valid === true ? 'Yes' : enrichment.email_valid === false ? 'No' : 'Unknown'}
- **Disposable Email:** ${enrichment.email_is_disposable === true ? 'YES (flag)' : 'No'}
- **Phone:** ${enrichment.phone_formatted || lead.phone || lead.mobile || 'N/A'}
- **Phone Valid:** ${enrichment.phone_valid === true ? 'Yes' : 'Unknown'}
- **Phone Type:** ${enrichment.phone_type || 'unknown'}
- **Phone Country:** ${enrichment.phone_country || 'unknown'}
- **Domain:** ${domain || 'N/A'}
- **Website:** ${enrichment.domain_has_website ? `https://${domain}` : 'No website found'}
- **Confidence Score:** ${score}/100 (${tier})
- **Lead Source:** ${enrichment.lead_table}
- **Business:** ${lead.business || 'N/A'}
- **Revenue:** ${lead.revenue || 'N/A'}
- **Submitted:** ${lead.created_at ? new Date(lead.created_at).toISOString().split('T')[0] : now}

## Confidence Breakdown
${Object.entries(breakdown).map(([signal, points]) => `- **${signal.replace(/_/g, ' ')}:** +${points}`).join('\n') || '- No signals detected'}

## Domain Intelligence
- **Has Website:** ${enrichment.domain_has_website ? 'Yes' : 'No'}
- **Hosting:** ${enrichment.domain_hosting_provider || 'unknown'}
- **Tech Stack:** ${techSection}
${companyDescription ? `- **Description:** ${companyDescription}` : ''}

## Company Social Links (from their website, not verified as personal)
${socialSection}

## Digital Footprint
${platformSection}
${enrichment.gravatar_exists ? `- **Gravatar:** ${enrichment.gravatar_url}` : '- No Gravatar found'}

## What They Want
${lead.help_wanted || lead.investment_readiness || 'Not specified in form submission'}

## Notes
Auto-generated from Supabase lead enrichment pipeline on ${now}.
Enrichment took ${enrichment.enrichment_duration_ms}ms.
${enrichment.errors?.length > 0 ? `\nErrors during enrichment: ${JSON.stringify(enrichment.errors)}` : ''}

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

  const enrichments = await fetchEnrichments();
  console.log(`Found ${enrichments.length} enrichments in Supabase`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const enrichment of enrichments) {
    const lead = await fetchLead(enrichment.lead_table, enrichment.lead_id);
    if (!lead) {
      console.log(`  Skip: lead ${enrichment.lead_id} not found in ${enrichment.lead_table}`);
      skipped++;
      continue;
    }

    const name = lead.name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
    if (!name || name === 'KeyRotation Test') {
      skipped++;
      continue;
    }

    const slug = slugify(name);
    const filePath = path.join(VAULT_LEADS_DIR, `${slug}.md`);

    const dossier = buildDossier(lead, enrichment);

    const exists = fs.existsSync(filePath);
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
