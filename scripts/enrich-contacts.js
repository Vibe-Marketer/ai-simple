#!/usr/bin/env node

/**
 * Contact Enrichment Pipeline — CLI
 *
 * Usage:
 *   node scripts/enrich-contacts.js enrich --limit 10
 *   node scripts/enrich-contacts.js enrich-one --id 12345
 *   node scripts/enrich-contacts.js listen --areas "Miami,Fort Lauderdale"
 *   node scripts/enrich-contacts.js setup-fields
 *   node scripts/enrich-contacts.js status
 *   node scripts/enrich-contacts.js test-profile
 *
 * Environment Variables:
 *   FUB_API_KEY       — Follow Up Boss API key (required for FUB operations)
 *   OPENAI_API_KEY    — OpenAI API key (required for profiling & deep listening)
 *   SUPABASE_URL      — Supabase URL (optional, falls back to local JSON)
 *   SUPABASE_KEY      — Supabase anon key (optional)
 */

const { enrichContact, batchEnrich, batchListen } = require('../src/pipeline');
const fub = require('../src/fub/client');
const store = require('../src/db/store');
const { generateProfile, generateMinimalProfile, getQuickTip } = require('../src/profiling/analyzer');
const { discoverProfiles } = require('../src/enrichment/discover');
const { detectSignals, scanForKeywords } = require('../src/listening/detector');

const args = process.argv.slice(2);
const command = args[0];

function getArg(name, defaultVal = null) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return defaultVal;
  return args[idx + 1] || defaultVal;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   FUB Contact Enrichment & Social Listening Pipeline    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();

  switch (command) {
    case 'enrich':
      await runBatchEnrich();
      break;

    case 'enrich-one':
      await runEnrichOne();
      break;

    case 'listen':
      await runListen();
      break;

    case 'setup-fields':
      await runSetupFields();
      break;

    case 'status':
      await runStatus();
      break;

    case 'test-profile':
      await runTestProfile();
      break;

    case 'test-discover':
      await runTestDiscover();
      break;

    case 'test-listen':
      await runTestListen();
      break;

    case 'help':
    default:
      printHelp();
      break;
  }
}

async function runBatchEnrich() {
  const limit = parseInt(getArg('limit', '10'));
  const stage = getArg('stage');
  const areas = getArg('areas', '').split(',').filter(Boolean);
  const agentArea = getArg('agent-area', '');
  const noPush = hasFlag('no-push');
  const onlyUnenriched = hasFlag('only-unenriched');

  console.log(`📋 Batch Enrichment`);
  console.log(`   Limit: ${limit}`);
  if (stage) console.log(`   Stage: ${stage}`);
  if (areas.length) console.log(`   Target Areas: ${areas.join(', ')}`);
  if (noPush) console.log(`   ⚠️  DRY RUN — not pushing to FUB`);

  const results = await batchEnrich({
    limit,
    stage,
    onlyUnenriched,
    pushToFub: !noPush,
    listeningConfig: {
      targetAreas: areas,
      agentArea,
    },
  });

  console.log('\n📊 Final Results:', JSON.stringify(results, null, 2));
}

async function runEnrichOne() {
  const contactId = getArg('id');
  const email = getArg('email');
  const noPush = hasFlag('no-push');

  if (!contactId && !email) {
    console.error('❌ Please provide --id <contactId> or --email <email>');
    process.exit(1);
  }

  let contact;
  if (contactId) {
    console.log(`🔍 Fetching contact ${contactId} from FUB...`);
    try {
      contact = await fub.getContact(contactId);
    } catch (err) {
      console.error(`❌ Failed to fetch contact: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log(`🔍 Searching for contact by email: ${email}...`);
    try {
      const result = await fub.getContacts({ email, limit: 1 });
      contact = result.people?.[0];
      if (!contact) {
        console.error('❌ No contact found with that email');
        process.exit(1);
      }
    } catch (err) {
      console.error(`❌ Failed to search contact: ${err.message}`);
      process.exit(1);
    }
  }

  const areas = getArg('areas', '').split(',').filter(Boolean);
  const result = await enrichContact(contact, {
    pushToFub: !noPush,
    listeningConfig: { targetAreas: areas },
  });

  console.log('\n📊 Result:', JSON.stringify(result, null, 2));
}

async function runListen() {
  const areas = getArg('areas', '').split(',').filter(Boolean);
  const agentArea = getArg('agent-area', '');
  const limit = parseInt(getArg('limit', '100'));
  const noPush = hasFlag('no-push');

  console.log(`👂 Social Listening Scan`);
  console.log(`   Target Areas: ${areas.join(', ') || 'none specified'}`);
  console.log(`   Limit: ${limit}`);

  const alerts = await batchListen({
    targetAreas: areas,
    agentArea,
    limit,
    pushToFub: !noPush,
  });

  console.log('\n🔔 Alerts:', JSON.stringify(alerts, null, 2));
}

async function runSetupFields() {
  console.log('🔧 Setting up FUB custom fields...');
  try {
    const created = await fub.ensureCustomFields();
    if (created.length > 0) {
      console.log(`✅ Created ${created.length} custom fields: ${created.join(', ')}`);
    } else {
      console.log('✅ All custom fields already exist');
    }
  } catch (err) {
    console.error(`❌ Failed: ${err.message}`);
  }
}

async function runStatus() {
  console.log('📊 Pipeline Status\n');

  // Check environment
  console.log('Environment:');
  console.log(`  FUB_API_KEY:    ${process.env.FUB_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`  SUPABASE_URL:   ${process.env.SUPABASE_URL ? '✅ Set' : '⚠️  Not set (using local JSON)'}`);
  console.log(`  Storage:        ${store.hasSupabase() ? 'Supabase' : 'Local JSON files'}`);

  // Check local data
  const enrichments = await store.getAllEnrichments();
  const alerts = await store.getRecentAlerts(100);
  console.log(`\nLocal Data:`);
  console.log(`  Enrichments: ${enrichments.length}`);
  console.log(`  Alerts:      ${alerts.length}`);

  // Test FUB connection
  if (process.env.FUB_API_KEY) {
    try {
      const result = await fub.getContacts({ limit: 1 });
      console.log(`\nFUB Connection: ✅ Connected (${result._metadata?.total || '?'} total contacts)`);
    } catch (err) {
      console.log(`\nFUB Connection: ❌ Failed (${err.message})`);
    }
  }
}

async function runTestProfile() {
  console.log('🧪 Testing DISC/OCEAN Profile Generation\n');
  console.log('  Using a mock contact with sample social data...\n');

  const mockContact = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    stage: 'Lead',
    source: 'Website',
    tags: ['Buyer'],
  };

  try {
    const profile = await generateMinimalProfile(mockContact);
    console.log('✅ Profile generated successfully!\n');
    console.log(`  DISC Primary: ${profile.disc?.primary} (${profile.disc?.primaryLabel})`);
    console.log(`  DISC Scores:  D=${profile.disc?.scores?.D} I=${profile.disc?.scores?.I} S=${profile.disc?.scores?.S} C=${profile.disc?.scores?.C}`);
    console.log(`  OCEAN:        O=${profile.ocean?.openness} C=${profile.ocean?.conscientiousness} E=${profile.ocean?.extraversion} A=${profile.ocean?.agreeableness} N=${profile.ocean?.neuroticism}`);
    console.log(`  Style:        ${profile.communicationStyle}`);
    console.log(`  Confidence:   ${profile.confidence}%`);
    console.log(`\n  Communication Guide:`);
    console.log(`  ${profile.communicationGuide}`);
    console.log(`\n  Quick Tip: ${getQuickTip(profile.disc?.primary).quickTip}`);
  } catch (err) {
    console.error(`❌ Test failed: ${err.message}`);
  }
}

async function runTestDiscover() {
  const name = getArg('name', 'Elon Musk');
  const email = getArg('email', '');

  console.log(`🧪 Testing Social Discovery for: ${name}\n`);

  try {
    const profiles = await discoverProfiles({
      firstName: name.split(' ')[0],
      lastName: name.split(' ').slice(1).join(' '),
      email,
    });

    console.log('Results:');
    for (const [platform, url] of Object.entries(profiles)) {
      if (platform === 'raw') continue;
      console.log(`  ${platform}: ${url || 'not found'}`);
    }
  } catch (err) {
    console.error(`❌ Test failed: ${err.message}`);
  }
}

async function runTestListen() {
  console.log('🧪 Testing Social Listening Signal Detection\n');

  const testPosts = [
    'Just booked our flight to Miami! Can\'t wait for some sunshine ☀️',
    'Anyone know a good realtor in the Austin area? Looking to buy our first home!',
    'So excited — we\'re engaged! 💍 Time to start planning the wedding AND house hunting!',
    'The housing market is insane right now. Interest rates are killing first-time buyers.',
    'Beautiful day at the beach. Love living in San Diego!',
    'Just got promoted to VP of Engineering! New chapter begins.',
  ];

  for (const post of testPosts) {
    console.log(`\n  Post: "${post}"`);
    const signals = scanForKeywords(post, 'test');
    if (signals.length > 0) {
      for (const s of signals) {
        console.log(`    🔔 ${s.signalType} (${s.confidence}%) — matched: "${s.matchedPattern}"`);
      }
    } else {
      console.log('    No keyword signals detected');
    }
  }

  // Test area detection
  console.log('\n\n  Testing area detection with target areas: ["Miami", "Austin"]');
  const { checkForAreaMention } = require('../src/listening/detector');
  for (const post of testPosts) {
    const area = checkForAreaMention(post, ['Miami', 'Austin']);
    if (area) {
      console.log(`    🎯 "${post.substring(0, 50)}..." → IN_AREA: ${area.matchedArea}`);
    }
  }
}

function printHelp() {
  console.log(`
Commands:
  enrich          Batch enrich contacts from FUB
                  --limit <n>          Max contacts (default: 10)
                  --stage <stage>      Filter by FUB stage
                  --areas <a,b,c>      Target areas for listening
                  --agent-area <area>  Agent's market area
                  --only-unenriched    Skip already enriched contacts
                  --no-push            Dry run (don't update FUB)

  enrich-one      Enrich a single contact
                  --id <contactId>     FUB contact ID
                  --email <email>      Or search by email
                  --areas <a,b,c>      Target areas for listening
                  --no-push            Dry run

  listen          Run social listening scan on enriched contacts
                  --areas <a,b,c>      Target areas to monitor
                  --agent-area <area>  Agent's market area
                  --limit <n>          Max contacts to scan
                  --no-push            Don't push alerts to FUB

  setup-fields    Create required custom fields in FUB

  status          Check pipeline status and environment

  test-profile    Test DISC/OCEAN profile generation (uses OpenAI)

  test-discover   Test social profile discovery
                  --name "John Doe"    Name to search
                  --email <email>      Email to search

  test-listen     Test social listening keyword detection

  help            Show this help message

Environment Variables:
  FUB_API_KEY       Follow Up Boss API key
  OPENAI_API_KEY    OpenAI API key
  SUPABASE_URL      Supabase project URL (optional)
  SUPABASE_KEY      Supabase anon key (optional)
`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
