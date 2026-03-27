/**
 * Social Profile Discovery Engine
 *
 * Discovers social media profiles for a contact using multiple strategies:
 * 1. Direct URL construction + validation (LinkedIn, Facebook, Instagram, X)
 * 2. Search engine queries (Google, Bing)
 * 3. Email-based lookups (Gravatar, etc.)
 *
 * All methods use only free, publicly available data.
 */

const cheerio = require('cheerio');

const PLATFORMS = {
  linkedin: {
    baseUrl: 'https://www.linkedin.com/in/',
    searchPattern: 'site:linkedin.com/in/',
    validate: (url) => url.includes('linkedin.com/in/'),
  },
  facebook: {
    baseUrl: 'https://www.facebook.com/',
    searchPattern: 'site:facebook.com/',
    validate: (url) => url.includes('facebook.com/') && !url.includes('/pages/'),
  },
  instagram: {
    baseUrl: 'https://www.instagram.com/',
    searchPattern: 'site:instagram.com/',
    validate: (url) => url.includes('instagram.com/') && !url.includes('/explore/'),
  },
  twitter: {
    baseUrl: 'https://x.com/',
    searchPattern: 'site:x.com/',
    validate: (url) => (url.includes('x.com/') || url.includes('twitter.com/')),
  },
};

/**
 * Discover social profiles for a contact.
 *
 * @param {Object} contact - { firstName, lastName, email, phone, company, location }
 * @returns {Object} - { linkedin, facebook, instagram, twitter, raw: [...] }
 */
async function discoverProfiles(contact) {
  const results = {
    linkedin: null,
    facebook: null,
    instagram: null,
    twitter: null,
    raw: [],
  };

  const { firstName, lastName, email } = contact;
  if (!firstName && !lastName && !email) return results;

  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  // Strategy 1: Google search for social profiles
  const searchResults = await searchForProfiles(fullName, email, contact.location);
  for (const result of searchResults) {
    for (const [platform, config] of Object.entries(PLATFORMS)) {
      if (!results[platform] && config.validate(result.url)) {
        results[platform] = result.url;
        results.raw.push({ platform, url: result.url, source: 'search', confidence: result.confidence || 70 });
      }
    }
  }

  // Strategy 2: Direct URL construction + HEAD check for common patterns
  if (!results.linkedin && fullName) {
    const slug = fullName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const linkedinUrl = `https://www.linkedin.com/in/${slug}`;
    const valid = await checkUrlExists(linkedinUrl);
    if (valid) {
      results.linkedin = linkedinUrl;
      results.raw.push({ platform: 'linkedin', url: linkedinUrl, source: 'direct', confidence: 60 });
    }
  }

  // Strategy 3: Gravatar lookup for avatar and linked profiles
  if (email) {
    const gravatar = await lookupGravatar(email);
    if (gravatar) {
      results.raw.push({ platform: 'gravatar', url: gravatar.url, source: 'gravatar', confidence: 90 });
      // Gravatar profiles sometimes link to social accounts
      if (gravatar.profiles) {
        for (const profile of gravatar.profiles) {
          for (const [platform, config] of Object.entries(PLATFORMS)) {
            if (!results[platform] && config.validate(profile.url)) {
              results[platform] = profile.url;
              results.raw.push({ platform, url: profile.url, source: 'gravatar', confidence: 85 });
            }
          }
        }
      }
    }
  }

  return results;
}

/**
 * Search Google for social profiles matching a person.
 */
async function searchForProfiles(fullName, email, location) {
  const results = [];
  if (!fullName) return results;

  const queries = [];

  // Build search queries for each platform
  for (const [platform, config] of Object.entries(PLATFORMS)) {
    let query = `${config.searchPattern} "${fullName}"`;
    if (location) query += ` ${location}`;
    queries.push({ platform, query });
  }

  // Also try a combined query
  if (email) {
    queries.push({ platform: 'any', query: `"${fullName}" "${email}" social media profile` });
  }

  for (const { platform, query } of queries) {
    try {
      const searchResults = await googleSearch(query);
      for (const sr of searchResults) {
        results.push({
          url: sr.url,
          title: sr.title,
          snippet: sr.snippet,
          confidence: calculateConfidence(sr, fullName, platform),
        });
      }
    } catch (err) {
      console.warn(`[Discover] Search failed for ${platform}: ${err.message}`);
    }
  }

  return results;
}

/**
 * Perform a Google search and parse results.
 * Uses a simple fetch approach with Google's search page.
 */
async function googleSearch(query) {
  const results = [];
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      // Google wraps URLs in /url?q= format
      const match = href.match(/\/url\?q=([^&]+)/);
      if (match) {
        const decodedUrl = decodeURIComponent(match[1]);
        if (decodedUrl.startsWith('http') && !decodedUrl.includes('google.com')) {
          results.push({
            url: decodedUrl,
            title: $(el).text().trim(),
            snippet: '',
          });
        }
      }
    });
  } catch (err) {
    console.warn(`[Discover] Google search error: ${err.message}`);
  }
  return results.slice(0, 10);
}

/**
 * Check if a URL exists by sending a HEAD request.
 */
async function checkUrlExists(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Look up a Gravatar profile by email.
 */
async function lookupGravatar(email) {
  try {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
    const url = `https://www.gravatar.com/${hash}.json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const entry = data.entry?.[0];
    if (!entry) return null;
    return {
      url: `https://www.gravatar.com/${hash}`,
      displayName: entry.displayName,
      aboutMe: entry.aboutMe,
      profiles: (entry.accounts || []).map(a => ({
        platform: a.shortname,
        url: a.url,
        username: a.username,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Calculate confidence score for a search result matching a person.
 */
function calculateConfidence(searchResult, fullName, platform) {
  let score = 50;
  const title = (searchResult.title || '').toLowerCase();
  const nameParts = fullName.toLowerCase().split(' ');

  // Name match in title
  if (nameParts.every(part => title.includes(part))) score += 30;
  else if (nameParts.some(part => title.includes(part))) score += 15;

  // Platform-specific URL validation
  if (PLATFORMS[platform]?.validate(searchResult.url)) score += 10;

  // Penalize generic/directory pages
  if (searchResult.url.includes('/search') || searchResult.url.includes('/directory')) score -= 20;

  return Math.min(100, Math.max(0, score));
}

module.exports = {
  discoverProfiles,
  searchForProfiles,
  googleSearch,
  checkUrlExists,
  lookupGravatar,
  PLATFORMS,
};
