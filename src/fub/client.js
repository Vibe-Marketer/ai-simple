/**
 * Follow Up Boss API Client
 *
 * A complete wrapper for the FUB REST API v1.
 * Handles authentication, pagination, rate limiting, and all CRUD operations
 * for contacts, custom fields, notes, and events.
 *
 * Usage:
 *   const fub = require('./client');
 *   const contacts = await fub.getContacts({ limit: 50 });
 */

const FUB_BASE_URL = 'https://api.followupboss.com/v1';

function getApiKey() {
  const key = process.env.FUB_API_KEY;
  if (!key) throw new Error('FUB_API_KEY environment variable is required');
  return key;
}

function authHeader() {
  return 'Basic ' + Buffer.from(getApiKey() + ':').toString('base64');
}

async function request(method, path, body = null, params = {}) {
  const url = new URL(FUB_BASE_URL + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const headers = {
    'Authorization': authHeader(),
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const opts = { method, headers };
  if (body && (method === 'POST' || method === 'PUT')) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), opts);

  // Handle rate limiting with exponential backoff
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
    console.warn(`[FUB] Rate limited. Retrying after ${retryAfter}s...`);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return request(method, path, body, params);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[FUB] ${method} ${path} failed (${res.status}): ${text}`);
  }

  // DELETE returns 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// ─── CONTACTS (People) ──────────────────────────────────────────────────────

/**
 * Fetch contacts from FUB with optional filters.
 * @param {Object} opts - Query parameters (limit, offset, fields, stage, etc.)
 * @returns {Promise<Object>} - { people: [...], _metadata: {...} }
 */
async function getContacts(opts = {}) {
  const defaults = {
    limit: 100,
    offset: 0,
    sort: 'created',
    fields: 'allFields',
    includeTrash: false,
    includeUnclaimed: false,
  };
  return request('GET', '/people', null, { ...defaults, ...opts });
}

/**
 * Fetch ALL contacts using automatic pagination.
 * @param {Object} opts - Base query parameters
 * @returns {AsyncGenerator<Object>} - Yields individual contact objects
 */
async function* getAllContacts(opts = {}) {
  let offset = 0;
  const limit = 100;
  while (true) {
    const result = await getContacts({ ...opts, limit, offset });
    const people = result.people || [];
    for (const person of people) {
      yield person;
    }
    if (people.length < limit) break;
    offset += limit;
  }
}

/**
 * Get a single contact by ID.
 */
async function getContact(id) {
  return request('GET', `/people/${id}`, null, { fields: 'allFields' });
}

/**
 * Update a contact in FUB.
 * @param {number} id - Contact ID
 * @param {Object} data - Fields to update (including custom fields prefixed with "custom")
 */
async function updateContact(id, data) {
  return request('PUT', `/people/${id}`, data);
}

/**
 * Create a new contact in FUB.
 */
async function createContact(data) {
  return request('POST', '/people', data);
}

/**
 * Check if a contact already exists by email or phone.
 */
async function checkDuplicate(params) {
  return request('GET', '/people/checkDuplicate', null, params);
}

// ─── NOTES ──────────────────────────────────────────────────────────────────

/**
 * Create a note on a contact.
 * @param {number} personId - The FUB person ID
 * @param {string} subject - Note subject
 * @param {string} body - Note body (HTML supported)
 */
async function createNote(personId, subject, body) {
  return request('POST', '/notes', {
    personId,
    subject,
    body,
    isHtml: true,
  });
}

/**
 * Update an existing note.
 */
async function updateNote(noteId, data) {
  return request('PUT', `/notes/${noteId}`, data);
}

// ─── CUSTOM FIELDS ──────────────────────────────────────────────────────────

/**
 * List all custom fields in the account.
 */
async function getCustomFields() {
  return request('GET', '/customFields');
}

/**
 * Create a new custom field.
 * @param {Object} field - { name, type, choices? }
 *   type: 'text', 'number', 'date', 'dropdown', 'checkbox'
 */
async function createCustomField(field) {
  return request('POST', '/customFields', field);
}

/**
 * Ensure required custom fields exist for the enrichment pipeline.
 * Creates them if missing.
 */
async function ensureCustomFields() {
  const required = [
    { name: 'DISC Profile', type: 'text' },
    { name: 'DISC Primary', type: 'text' },
    { name: 'OCEAN Scores', type: 'text' },
    { name: 'Communication Style', type: 'text' },
    { name: 'Social LinkedIn', type: 'text' },
    { name: 'Social Facebook', type: 'text' },
    { name: 'Social Instagram', type: 'text' },
    { name: 'Social X', type: 'text' },
    { name: 'Enrichment Status', type: 'text' },
    { name: 'Last Enriched', type: 'date' },
    { name: 'Social Listening Alerts', type: 'text' },
  ];

  const existing = await getCustomFields();
  const existingNames = new Set(
    (existing.customFields || []).map(f => f.name.toLowerCase())
  );

  const created = [];
  for (const field of required) {
    if (!existingNames.has(field.name.toLowerCase())) {
      try {
        await createCustomField(field);
        created.push(field.name);
        console.log(`[FUB] Created custom field: ${field.name}`);
      } catch (err) {
        console.warn(`[FUB] Could not create field "${field.name}": ${err.message}`);
      }
    }
  }
  return created;
}

// ─── EVENTS ─────────────────────────────────────────────────────────────────

/**
 * Push an event/lead into FUB.
 */
async function createEvent(data) {
  return request('POST', '/events', data);
}

/**
 * Get events with optional filters.
 */
async function getEvents(opts = {}) {
  return request('GET', '/events', null, opts);
}

// ─── TAGS ───────────────────────────────────────────────────────────────────

/**
 * Add tags to a contact.
 * FUB merges tags on PUT, so we fetch existing and merge.
 */
async function addTags(personId, newTags) {
  const person = await getContact(personId);
  const existingTags = person.tags || [];
  const mergedTags = [...new Set([...existingTags, ...newTags])];
  return updateContact(personId, { tags: mergedTags });
}

// ─── SMART LISTS ────────────────────────────────────────────────────────────

async function getSmartLists() {
  return request('GET', '/smartLists');
}

async function getSmartList(id) {
  return request('GET', `/smartLists/${id}`);
}

// ─── USERS ──────────────────────────────────────────────────────────────────

async function getUsers() {
  return request('GET', '/users');
}

async function getUser(id) {
  return request('GET', `/users/${id}`);
}

module.exports = {
  getContacts,
  getAllContacts,
  getContact,
  updateContact,
  createContact,
  checkDuplicate,
  createNote,
  updateNote,
  getCustomFields,
  createCustomField,
  ensureCustomFields,
  createEvent,
  getEvents,
  addTags,
  getSmartLists,
  getSmartList,
  getUsers,
  getUser,
};
