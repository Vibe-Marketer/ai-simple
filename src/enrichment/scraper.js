/**
 * Social Data Scraper
 *
 * Extracts publicly available data from social media profiles.
 * Focuses on bio information, recent public posts, professional details,
 * and any signals useful for personality profiling and social listening.
 *
 * Uses only publicly accessible data — no login or API keys required
 * for the social platforms themselves.
 */

const cheerio = require('cheerio');

/**
 * Extract data from all discovered social profiles.
 *
 * @param {Object} profiles - { linkedin, facebook, instagram, twitter }
 * @returns {Object} - Aggregated social data
 */
async function extractAllProfiles(profiles) {
  const data = {
    linkedin: null,
    facebook: null,
    instagram: null,
    twitter: null,
    aggregated: {
      bio: '',
      headline: '',
      location: '',
      company: '',
      jobTitle: '',
      interests: [],
      recentPosts: [],
      connections: null,
      followerCount: null,
    },
  };

  const extractors = [
    { platform: 'linkedin', url: profiles.linkedin, fn: extractLinkedIn },
    { platform: 'facebook', url: profiles.facebook, fn: extractFacebook },
    { platform: 'instagram', url: profiles.instagram, fn: extractInstagram },
    { platform: 'twitter', url: profiles.twitter, fn: extractTwitter },
  ];

  for (const { platform, url, fn } of extractors) {
    if (!url) continue;
    try {
      data[platform] = await fn(url);
      mergeIntoAggregated(data.aggregated, data[platform], platform);
    } catch (err) {
      console.warn(`[Scraper] Failed to extract ${platform}: ${err.message}`);
      data[platform] = { error: err.message };
    }
  }

  return data;
}

/**
 * Fetch a page with browser-like headers.
 */
async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * Extract data from a LinkedIn profile (public view).
 */
async function extractLinkedIn(url) {
  const result = {
    platform: 'linkedin',
    url,
    name: null,
    headline: null,
    location: null,
    summary: null,
    company: null,
    jobTitle: null,
    connections: null,
    skills: [],
    recentActivity: [],
  };

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    // LinkedIn public profiles have structured data in JSON-LD
    const jsonLd = $('script[type="application/ld+json"]').text();
    if (jsonLd) {
      try {
        const ld = JSON.parse(jsonLd);
        result.name = ld.name || null;
        result.jobTitle = ld.jobTitle || null;
        result.location = ld.address?.addressLocality || null;
        result.company = ld.worksFor?.name || null;
        result.summary = ld.description || null;
      } catch { /* JSON parse error, continue */ }
    }

    // Fallback to meta tags
    if (!result.name) result.name = $('meta[property="og:title"]').attr('content') || null;
    if (!result.summary) result.summary = $('meta[property="og:description"]').attr('content') || null;
    result.headline = $('meta[name="description"]').attr('content') || null;

    // Extract visible text sections
    $('section').each((_, section) => {
      const text = $(section).text().trim();
      if (text.length > 50 && text.length < 2000) {
        result.recentActivity.push(text.substring(0, 500));
      }
    });
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

/**
 * Extract data from a Facebook profile (public view).
 */
async function extractFacebook(url) {
  const result = {
    platform: 'facebook',
    url,
    name: null,
    bio: null,
    location: null,
    recentPosts: [],
  };

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    result.name = $('meta[property="og:title"]').attr('content') || null;
    result.bio = $('meta[property="og:description"]').attr('content') || null;

    // Extract any visible post content
    $('[data-testid="post_message"]').each((i, el) => {
      if (i < 10) {
        result.recentPosts.push($(el).text().trim().substring(0, 500));
      }
    });
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

/**
 * Extract data from an Instagram profile (public view).
 */
async function extractInstagram(url) {
  const result = {
    platform: 'instagram',
    url,
    name: null,
    bio: null,
    followerCount: null,
    followingCount: null,
    postCount: null,
    recentCaptions: [],
  };

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    result.name = $('meta[property="og:title"]').attr('content') || null;
    result.bio = $('meta[property="og:description"]').attr('content') || null;

    // Try to extract follower counts from description
    const desc = result.bio || '';
    const followerMatch = desc.match(/([\d,.]+[KkMm]?)\s*Followers/i);
    if (followerMatch) result.followerCount = followerMatch[1];

    const followingMatch = desc.match(/([\d,.]+[KkMm]?)\s*Following/i);
    if (followingMatch) result.followingCount = followingMatch[1];

    const postMatch = desc.match(/([\d,.]+[KkMm]?)\s*Posts/i);
    if (postMatch) result.postCount = postMatch[1];

    // Try to extract from JSON embedded data
    const scripts = $('script').toArray();
    for (const script of scripts) {
      const text = $(script).html() || '';
      if (text.includes('biography')) {
        try {
          const match = text.match(/"biography":"([^"]+)"/);
          if (match) result.bio = match[1].replace(/\\n/g, '\n');
        } catch { /* continue */ }
      }
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

/**
 * Extract data from a Twitter/X profile (public view).
 */
async function extractTwitter(url) {
  const result = {
    platform: 'twitter',
    url,
    name: null,
    bio: null,
    location: null,
    followerCount: null,
    recentTweets: [],
  };

  try {
    // Use Nitter or similar public frontend as fallback
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    result.name = $('meta[property="og:title"]').attr('content') || null;
    result.bio = $('meta[property="og:description"]').attr('content') || null;

    // Try to parse structured data
    const jsonLd = $('script[type="application/ld+json"]').text();
    if (jsonLd) {
      try {
        const ld = JSON.parse(jsonLd);
        if (Array.isArray(ld)) {
          const person = ld.find(item => item['@type'] === 'Person');
          if (person) {
            result.name = person.name || result.name;
            result.bio = person.description || result.bio;
          }
        }
      } catch { /* continue */ }
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

/**
 * Merge platform-specific data into the aggregated profile.
 */
function mergeIntoAggregated(agg, platformData, platform) {
  if (!platformData || platformData.error) return;

  if (platformData.bio && !agg.bio) agg.bio = platformData.bio;
  if (platformData.headline && !agg.headline) agg.headline = platformData.headline;
  if (platformData.location && !agg.location) agg.location = platformData.location;
  if (platformData.company && !agg.company) agg.company = platformData.company;
  if (platformData.jobTitle && !agg.jobTitle) agg.jobTitle = platformData.jobTitle;
  if (platformData.followerCount && !agg.followerCount) agg.followerCount = platformData.followerCount;
  if (platformData.connections && !agg.connections) agg.connections = platformData.connections;

  // Merge recent posts/activity
  const posts = platformData.recentPosts || platformData.recentActivity || platformData.recentTweets || platformData.recentCaptions || [];
  for (const post of posts) {
    if (post && typeof post === 'string') {
      agg.recentPosts.push({ platform, content: post, extractedAt: new Date().toISOString() });
    }
  }
}

module.exports = {
  extractAllProfiles,
  extractLinkedIn,
  extractFacebook,
  extractInstagram,
  extractTwitter,
  fetchPage,
};
