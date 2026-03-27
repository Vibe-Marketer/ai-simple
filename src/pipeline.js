/**
 * Contact Enrichment Pipeline — Main Orchestrator
 *
 * This is the core pipeline that ties together all modules:
 * 1. FUB contact retrieval
 * 2. Social profile discovery
 * 3. Social data extraction
 * 4. DISC/OCEAN profiling via LLM
 * 5. Social listening signal detection
 * 6. Push results back to FUB
 *
 * Can be run for a single contact or in batch mode.
 */

const fub = require('./fub/client');
const mapper = require('./fub/mapper');
const { discoverProfiles } = require('./enrichment/discover');
const { extractAllProfiles } = require('./enrichment/scraper');
const { generateProfile, generateMinimalProfile } = require('./profiling/analyzer');
const { detectSignals, getSuggestedAction } = require('./listening/detector');
const store = require('./db/store');

/**
 * Enrich a single contact end-to-end.
 *
 * @param {Object} contact - FUB contact object (must have id, firstName, lastName, email)
 * @param {Object} opts - Pipeline options
 * @param {boolean} opts.skipSocialDiscovery - Skip social profile discovery
 * @param {boolean} opts.skipProfiling - Skip DISC/OCEAN profiling
 * @param {boolean} opts.skipListening - Skip social listening
 * @param {boolean} opts.pushToFub - Push results back to FUB (default: true)
 * @param {Object} opts.listeningConfig - Config for social listening
 * @returns {Object} - Complete enrichment result
 */
async function enrichContact(contact, opts = {}) {
  const startTime = Date.now();
  const contactId = contact.id;
  const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown';

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔍 Enriching: ${contactName} (ID: ${contactId})`);
  console.log(`${'═'.repeat(60)}`);

  const result = {
    contactId,
    contactName,
    socialProfiles: {},
    socialData: null,
    profile: null,
    signals: [],
    fubUpdated: false,
    errors: [],
    duration: 0,
  };

  try {
    // ── Step 1: Discover Social Profiles ──────────────────────────────
    if (!opts.skipSocialDiscovery) {
      console.log('  📱 Step 1: Discovering social profiles...');
      try {
        result.socialProfiles = await discoverProfiles({
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.emails?.[0]?.value || contact.email,
          phone: contact.phones?.[0]?.value || contact.phone,
          location: contact.addresses?.[0]?.city || '',
        });
        const found = Object.entries(result.socialProfiles)
          .filter(([k, v]) => v && k !== 'raw')
          .map(([k]) => k);
        console.log(`     Found: ${found.length > 0 ? found.join(', ') : 'none'}`);
      } catch (err) {
        console.warn(`     ⚠️  Discovery failed: ${err.message}`);
        result.errors.push({ step: 'discovery', error: err.message });
      }
    }

    // ── Step 2: Extract Social Data ──────────────────────────────────
    const hasProfiles = Object.values(result.socialProfiles).some(v => v && typeof v === 'string');
    if (hasProfiles && !opts.skipSocialDiscovery) {
      console.log('  📊 Step 2: Extracting social data...');
      try {
        result.socialData = await extractAllProfiles(result.socialProfiles);
        const postCount = result.socialData?.aggregated?.recentPosts?.length || 0;
        console.log(`     Extracted ${postCount} posts/activities`);
      } catch (err) {
        console.warn(`     ⚠️  Extraction failed: ${err.message}`);
        result.errors.push({ step: 'extraction', error: err.message });
      }
    } else {
      console.log('  📊 Step 2: No social profiles found, skipping extraction');
    }

    // ── Step 3: Generate DISC/OCEAN Profile ──────────────────────────
    if (!opts.skipProfiling) {
      console.log('  🧠 Step 3: Generating DISC/OCEAN profile...');
      try {
        if (result.socialData) {
          result.profile = await generateProfile(result.socialData, contact);
        } else {
          result.profile = await generateMinimalProfile(contact);
        }
        console.log(`     DISC: ${result.profile.disc?.primary} (${result.profile.disc?.primaryLabel})`);
        console.log(`     Confidence: ${result.profile.confidence}%`);
        console.log(`     Style: ${result.profile.communicationStyle}`);
      } catch (err) {
        console.warn(`     ⚠️  Profiling failed: ${err.message}`);
        result.errors.push({ step: 'profiling', error: err.message });
      }
    }

    // ── Step 4: Social Listening ─────────────────────────────────────
    if (!opts.skipListening && result.socialData) {
      console.log('  👂 Step 4: Running social listening...');
      try {
        result.signals = await detectSignals(result.socialData, {
          targetAreas: opts.listeningConfig?.targetAreas || [],
          agentArea: opts.listeningConfig?.agentArea || '',
          agentSpecialties: opts.listeningConfig?.agentSpecialties || [],
          useLLM: opts.listeningConfig?.useLLM !== false,
        });

        if (result.signals.length > 0) {
          console.log(`     🔔 ${result.signals.length} signal(s) detected:`);
          for (const signal of result.signals) {
            console.log(`        - ${signal.signalType} (${signal.confidence}% confidence)`);
          }
        } else {
          console.log('     No signals detected');
        }
      } catch (err) {
        console.warn(`     ⚠️  Listening failed: ${err.message}`);
        result.errors.push({ step: 'listening', error: err.message });
      }
    }

    // ── Step 5: Push to FUB ──────────────────────────────────────────
    if (opts.pushToFub !== false && contactId) {
      console.log('  📤 Step 5: Pushing results to FUB...');
      try {
        await pushToFub(contactId, result);
        result.fubUpdated = true;
        console.log('     ✅ FUB updated successfully');
      } catch (err) {
        console.warn(`     ⚠️  FUB push failed: ${err.message}`);
        result.errors.push({ step: 'fub_push', error: err.message });
      }
    }

    // ── Step 6: Save to Local Store ──────────────────────────────────
    console.log('  💾 Step 6: Saving enrichment data...');
    await store.saveEnrichment(contactId, {
      socialProfiles: result.socialProfiles,
      profile: result.profile,
      signals: result.signals,
    });
    if (result.profile) {
      await store.saveProfile(contactId, result.profile);
    }
    for (const signal of result.signals) {
      await store.saveAlert({
        contactId,
        contactName,
        ...signal,
        suggestedAction: getSuggestedAction(signal),
      });
    }

  } catch (err) {
    console.error(`  ❌ Pipeline error: ${err.message}`);
    result.errors.push({ step: 'pipeline', error: err.message });
  }

  result.duration = Date.now() - startTime;
  console.log(`\n  ⏱️  Completed in ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`  ${result.errors.length === 0 ? '✅ Success' : `⚠️  ${result.errors.length} error(s)`}`);

  return result;
}

/**
 * Push enrichment results back to FUB.
 */
async function pushToFub(contactId, result) {
  const updates = {};

  // Social profile links
  if (result.socialProfiles) {
    Object.assign(updates, mapper.socialLinksToCustomFields(result.socialProfiles));
  }

  // DISC/OCEAN profile
  if (result.profile) {
    Object.assign(updates, mapper.profileToCustomFields(result.profile));
  }

  // Enrichment status
  Object.assign(updates, mapper.enrichmentStatusFields('complete'));

  // Update contact custom fields
  if (Object.keys(updates).length > 0) {
    await fub.updateContact(contactId, updates);
  }

  // Create enrichment note
  if (result.profile) {
    const note = mapper.buildEnrichmentNote({
      profile: result.profile,
      socialProfiles: result.socialProfiles,
      socialActivity: result.socialData,
      contact: { id: contactId, name: result.contactName },
    });
    await fub.createNote(contactId, note.subject, note.body);
  }

  // Create alert notes for signals
  for (const signal of result.signals) {
    signal.suggestedAction = getSuggestedAction(signal);
    const alertNote = mapper.buildAlertNote(signal);
    await fub.createNote(contactId, alertNote.subject, alertNote.body);
  }

  // Add tags
  const tags = mapper.enrichmentToTags(result.profile, result.signals);
  if (tags.length > 0) {
    await fub.addTags(contactId, tags);
  }
}

/**
 * Run batch enrichment for multiple contacts.
 *
 * @param {Object} opts - Batch options
 * @param {number} opts.limit - Max contacts to process (default: 50)
 * @param {string} opts.stage - Filter by FUB stage
 * @param {boolean} opts.onlyUnenriched - Only process contacts not yet enriched
 * @param {number} opts.delayMs - Delay between contacts (default: 2000ms)
 * @param {Object} opts.listeningConfig - Social listening config
 * @returns {Object} - Batch results summary
 */
async function batchEnrich(opts = {}) {
  const limit = opts.limit || 50;
  const delayMs = opts.delayMs || 2000;

  console.log('\n' + '═'.repeat(60));
  console.log('🚀 BATCH ENRICHMENT PIPELINE');
  console.log('═'.repeat(60));
  console.log(`  Limit: ${limit} contacts`);
  console.log(`  Delay: ${delayMs}ms between contacts`);

  // Fetch contacts from FUB
  const fubOpts = { limit };
  if (opts.stage) fubOpts.stage = opts.stage;

  let contacts;
  try {
    const response = await fub.getContacts(fubOpts);
    contacts = response.people || [];
  } catch (err) {
    console.error(`❌ Failed to fetch contacts from FUB: ${err.message}`);
    return { success: false, error: err.message };
  }

  console.log(`  Found ${contacts.length} contacts\n`);

  // Filter to unenriched if requested
  if (opts.onlyUnenriched) {
    contacts = contacts.filter(c => {
      return !c.customEnrichmentStatus || c.customEnrichmentStatus !== 'complete';
    });
    console.log(`  After filtering: ${contacts.length} unenriched contacts\n`);
  }

  const results = {
    total: contacts.length,
    success: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    console.log(`\n[${i + 1}/${contacts.length}]`);

    try {
      const enrichResult = await enrichContact(contact, {
        pushToFub: opts.pushToFub !== false,
        listeningConfig: opts.listeningConfig,
      });

      if (enrichResult.errors.length === 0) {
        results.success++;
      } else {
        results.failed++;
      }
      results.details.push({
        contactId: contact.id,
        name: `${contact.firstName} ${contact.lastName}`,
        disc: enrichResult.profile?.disc?.primary || null,
        signals: enrichResult.signals.length,
        errors: enrichResult.errors.length,
        duration: enrichResult.duration,
      });
    } catch (err) {
      results.failed++;
      results.details.push({
        contactId: contact.id,
        name: `${contact.firstName} ${contact.lastName}`,
        error: err.message,
      });
    }

    // Rate limiting delay
    if (i < contacts.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 BATCH RESULTS');
  console.log('═'.repeat(60));
  console.log(`  Total:   ${results.total}`);
  console.log(`  Success: ${results.success}`);
  console.log(`  Failed:  ${results.failed}`);
  console.log(`  Skipped: ${results.skipped}`);

  return results;
}

/**
 * Run social listening only (no enrichment) for already-enriched contacts.
 */
async function batchListen(opts = {}) {
  const limit = opts.limit || 100;

  console.log('\n' + '═'.repeat(60));
  console.log('👂 SOCIAL LISTENING SCAN');
  console.log('═'.repeat(60));

  // Get enriched contacts from local store
  const enrichments = await store.getAllEnrichments();
  const toScan = enrichments.slice(0, limit);

  console.log(`  Scanning ${toScan.length} enriched contacts\n`);

  const allAlerts = [];

  for (const enrichment of toScan) {
    if (!enrichment.socialProfiles) continue;

    try {
      // Re-scrape social data for fresh posts
      const socialData = await extractAllProfiles(enrichment.socialProfiles);

      // Run signal detection
      const signals = await detectSignals(socialData, {
        targetAreas: opts.targetAreas || [],
        agentArea: opts.agentArea || '',
        useLLM: opts.useLLM !== false,
      });

      for (const signal of signals) {
        const alert = {
          contactId: enrichment.contactId,
          ...signal,
          suggestedAction: getSuggestedAction(signal),
        };
        await store.saveAlert(alert);
        allAlerts.push(alert);

        // Push alert to FUB
        if (opts.pushToFub !== false && enrichment.contactId) {
          try {
            const alertNote = mapper.buildAlertNote(alert);
            await fub.createNote(enrichment.contactId, alertNote.subject, alertNote.body);
          } catch (err) {
            console.warn(`  ⚠️  Failed to push alert to FUB: ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.warn(`  ⚠️  Listening failed for ${enrichment.contactId}: ${err.message}`);
    }
  }

  console.log(`\n  🔔 Total alerts generated: ${allAlerts.length}`);
  return allAlerts;
}

module.exports = {
  enrichContact,
  batchEnrich,
  batchListen,
  pushToFub,
};
