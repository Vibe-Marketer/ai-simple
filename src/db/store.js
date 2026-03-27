/**
 * Data Store
 *
 * Provides a storage layer for the enrichment pipeline.
 * Supports two backends:
 *   1. Supabase (if SUPABASE_URL and SUPABASE_KEY are set)
 *   2. Local JSON file storage (fallback for development/testing)
 *
 * This abstraction allows the pipeline to run without Supabase
 * while still persisting data between runs.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const ENRICHMENTS_FILE = path.join(DATA_DIR, 'enrichments.json');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const SOCIAL_CACHE_FILE = path.join(DATA_DIR, 'social_cache.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Check if Supabase is configured.
 */
function hasSupabase() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
}

/**
 * Get Supabase client if available.
 */
function getSupabase() {
  if (!hasSupabase()) return null;
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

// ─── JSON File Helpers ──────────────────────────────────────────────────────

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Enrichment Records ─────────────────────────────────────────────────────

/**
 * Save an enrichment record for a contact.
 */
async function saveEnrichment(contactId, enrichmentData) {
  const record = {
    contactId,
    ...enrichmentData,
    updatedAt: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('contact_enrichments')
      .upsert(record, { onConflict: 'contactId' })
      .select();
    if (error) throw new Error(`Supabase save error: ${error.message}`);
    return data?.[0];
  }

  // Local fallback
  const records = readJson(ENRICHMENTS_FILE);
  const idx = records.findIndex(r => r.contactId === contactId);
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  writeJson(ENRICHMENTS_FILE, records);
  return record;
}

/**
 * Get enrichment record for a contact.
 */
async function getEnrichment(contactId) {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase
      .from('contact_enrichments')
      .select('*')
      .eq('contactId', contactId)
      .single();
    return data;
  }

  const records = readJson(ENRICHMENTS_FILE);
  return records.find(r => r.contactId === contactId) || null;
}

/**
 * Get all enrichment records.
 */
async function getAllEnrichments() {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase.from('contact_enrichments').select('*');
    return data || [];
  }
  return readJson(ENRICHMENTS_FILE);
}

// ─── Profile Cache ──────────────────────────────────────────────────────────

/**
 * Save a psychological profile for a contact.
 */
async function saveProfile(contactId, profileData) {
  const record = {
    contactId,
    ...profileData,
    updatedAt: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('contact_profiles')
      .upsert(record, { onConflict: 'contactId' })
      .select();
    if (error) throw new Error(`Supabase save error: ${error.message}`);
    return data?.[0];
  }

  const records = readJson(PROFILES_FILE);
  const idx = records.findIndex(r => r.contactId === contactId);
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  writeJson(PROFILES_FILE, records);
  return record;
}

/**
 * Get a psychological profile for a contact.
 */
async function getProfile(contactId) {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase
      .from('contact_profiles')
      .select('*')
      .eq('contactId', contactId)
      .single();
    return data;
  }

  const records = readJson(PROFILES_FILE);
  return records.find(r => r.contactId === contactId) || null;
}

// ─── Social Listening Alerts ────────────────────────────────────────────────

/**
 * Save a social listening alert.
 */
async function saveAlert(alert) {
  const record = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...alert,
    createdAt: new Date().toISOString(),
    acknowledged: false,
  };

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('social_alerts')
      .insert(record)
      .select();
    if (error) throw new Error(`Supabase save error: ${error.message}`);
    return data?.[0];
  }

  const records = readJson(ALERTS_FILE);
  records.push(record);
  writeJson(ALERTS_FILE, records);
  return record;
}

/**
 * Get alerts for a contact.
 */
async function getAlerts(contactId, opts = {}) {
  const supabase = getSupabase();
  if (supabase) {
    let query = supabase.from('social_alerts').select('*').eq('contactId', contactId);
    if (opts.unacknowledgedOnly) query = query.eq('acknowledged', false);
    const { data } = await query.order('createdAt', { ascending: false });
    return data || [];
  }

  const records = readJson(ALERTS_FILE);
  let filtered = records.filter(r => r.contactId === contactId);
  if (opts.unacknowledgedOnly) filtered = filtered.filter(r => !r.acknowledged);
  return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get all recent alerts.
 */
async function getRecentAlerts(limit = 50) {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase
      .from('social_alerts')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(limit);
    return data || [];
  }

  const records = readJson(ALERTS_FILE);
  return records
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

// ─── Social Data Cache ──────────────────────────────────────────────────────

/**
 * Cache social data to avoid redundant scraping.
 */
async function cacheSocialData(contactId, platform, data) {
  const record = {
    contactId,
    platform,
    data,
    cachedAt: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    await supabase
      .from('social_cache')
      .upsert(record, { onConflict: 'contactId,platform' });
    return;
  }

  const records = readJson(SOCIAL_CACHE_FILE);
  const idx = records.findIndex(r => r.contactId === contactId && r.platform === platform);
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  writeJson(SOCIAL_CACHE_FILE, records);
}

/**
 * Get cached social data.
 * Returns null if cache is older than maxAgeHours.
 */
async function getCachedSocialData(contactId, platform, maxAgeHours = 24) {
  const supabase = getSupabase();
  let record;

  if (supabase) {
    const { data } = await supabase
      .from('social_cache')
      .select('*')
      .eq('contactId', contactId)
      .eq('platform', platform)
      .single();
    record = data;
  } else {
    const records = readJson(SOCIAL_CACHE_FILE);
    record = records.find(r => r.contactId === contactId && r.platform === platform);
  }

  if (!record) return null;

  // Check age
  const age = (Date.now() - new Date(record.cachedAt).getTime()) / (1000 * 60 * 60);
  if (age > maxAgeHours) return null;

  return record.data;
}

module.exports = {
  saveEnrichment,
  getEnrichment,
  getAllEnrichments,
  saveProfile,
  getProfile,
  saveAlert,
  getAlerts,
  getRecentAlerts,
  cacheSocialData,
  getCachedSocialData,
  hasSupabase,
};
