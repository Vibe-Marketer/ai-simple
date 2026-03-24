/**
 * URL builder for tracked shortlinks.
 * Imported by email scripts to create tracked URLs with custom + UTM params.
 */

/**
 * Generate a single tracked URL
 * @param {string} slug - shortlink slug (e.g., 'mba-download')
 * @param {object} params - tracking parameters
 * @returns {string} full tracked URL
 */
export function generateTrackedUrl(slug, params = {}) {
  const base = 'https://aisimple.co';
  const url = new URL(`/${slug}`, base);

  // Custom tracking params
  if (params.email) url.searchParams.set('e', params.email);
  if (params.source) url.searchParams.set('src', params.source);
  if (params.campaignId) url.searchParams.set('cid', params.campaignId);
  if (params.messageId) url.searchParams.set('mid', params.messageId);
  if (params.contentType) url.searchParams.set('t', params.contentType);
  if (params.referrer) url.searchParams.set('ref', params.referrer);

  // Standard UTMs
  if (params.utmSource) url.searchParams.set('utm_source', params.utmSource);
  if (params.utmMedium) url.searchParams.set('utm_medium', params.utmMedium);
  if (params.utmCampaign) url.searchParams.set('utm_campaign', params.utmCampaign);
  if (params.utmContent) url.searchParams.set('utm_content', params.utmContent);
  if (params.utmTerm) url.searchParams.set('utm_term', params.utmTerm);

  return url.toString();
}

/**
 * Generate multiple tracked URLs with shared params
 * @param {Array} links - [{slug, text, params}]
 * @param {object} sharedParams - params applied to all links
 * @returns {Array} [{url, text}]
 */
export function trackLinks(links, sharedParams = {}) {
  return links.map(l => ({
    url: generateTrackedUrl(l.slug, { ...sharedParams, ...l.params }),
    text: l.text,
  }));
}
