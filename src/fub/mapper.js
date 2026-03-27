/**
 * FUB Data Mapper
 *
 * Transforms enrichment pipeline output into FUB-compatible formats
 * for custom fields, notes, and tags.
 */

/**
 * Convert DISC/OCEAN profile data into FUB custom field updates.
 * Custom field names must be camelCase prefixed with "custom".
 */
function profileToCustomFields(profile) {
  const fields = {};

  if (profile.disc) {
    fields.customDiscPrimary = profile.disc.primary || '';
    fields.customDiscProfile = JSON.stringify({
      D: profile.disc.scores?.D || 0,
      I: profile.disc.scores?.I || 0,
      S: profile.disc.scores?.S || 0,
      C: profile.disc.scores?.C || 0,
    });
  }

  if (profile.ocean) {
    fields.customOceanScores = JSON.stringify({
      O: profile.ocean.openness || 0,
      C: profile.ocean.conscientiousness || 0,
      E: profile.ocean.extraversion || 0,
      A: profile.ocean.agreeableness || 0,
      N: profile.ocean.neuroticism || 0,
    });
  }

  if (profile.communicationStyle) {
    fields.customCommunicationStyle = profile.communicationStyle.substring(0, 500);
  }

  return fields;
}

/**
 * Convert social profile URLs into FUB custom field updates.
 */
function socialLinksToCustomFields(socialProfiles) {
  const fields = {};
  if (socialProfiles.linkedin) fields.customSocialLinkedin = socialProfiles.linkedin;
  if (socialProfiles.facebook) fields.customSocialFacebook = socialProfiles.facebook;
  if (socialProfiles.instagram) fields.customSocialInstagram = socialProfiles.instagram;
  if (socialProfiles.twitter) fields.customSocialX = socialProfiles.twitter;
  return fields;
}

/**
 * Build the enrichment status custom fields.
 */
function enrichmentStatusFields(status = 'complete') {
  return {
    customEnrichmentStatus: status,
    customLastEnriched: new Date().toISOString().split('T')[0],
  };
}

/**
 * Build a comprehensive enrichment Note (HTML) for a contact.
 */
function buildEnrichmentNote(enrichmentData) {
  const { profile, socialProfiles, socialActivity, contact } = enrichmentData;

  let html = `<h3>🔍 Contact Enrichment Report</h3>`;
  html += `<p><strong>Generated:</strong> ${new Date().toISOString()}</p>`;

  // Social Profiles Section
  html += `<h4>📱 Social Profiles Found</h4><ul>`;
  if (socialProfiles.linkedin) html += `<li><strong>LinkedIn:</strong> <a href="${socialProfiles.linkedin}">${socialProfiles.linkedin}</a></li>`;
  if (socialProfiles.facebook) html += `<li><strong>Facebook:</strong> <a href="${socialProfiles.facebook}">${socialProfiles.facebook}</a></li>`;
  if (socialProfiles.instagram) html += `<li><strong>Instagram:</strong> <a href="${socialProfiles.instagram}">${socialProfiles.instagram}</a></li>`;
  if (socialProfiles.twitter) html += `<li><strong>X/Twitter:</strong> <a href="${socialProfiles.twitter}">${socialProfiles.twitter}</a></li>`;
  html += `</ul>`;

  // DISC Profile
  if (profile?.disc) {
    html += `<h4>🎯 DISC Profile</h4>`;
    html += `<p><strong>Primary Type:</strong> ${profile.disc.primary} (${profile.disc.primaryLabel})</p>`;
    html += `<table border="1" cellpadding="4" style="border-collapse:collapse;">`;
    html += `<tr><th>Trait</th><th>Score</th><th>Level</th></tr>`;
    const traits = { D: 'Dominance', I: 'Influence', S: 'Steadiness', C: 'Conscientiousness' };
    for (const [key, label] of Object.entries(traits)) {
      const score = profile.disc.scores?.[key] || 0;
      const level = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
      html += `<tr><td>${label}</td><td>${score}/100</td><td>${level}</td></tr>`;
    }
    html += `</table>`;
  }

  // OCEAN Profile
  if (profile?.ocean) {
    html += `<h4>🌊 OCEAN (Big Five) Profile</h4>`;
    html += `<table border="1" cellpadding="4" style="border-collapse:collapse;">`;
    html += `<tr><th>Trait</th><th>Score</th></tr>`;
    const oceanTraits = {
      openness: 'Openness',
      conscientiousness: 'Conscientiousness',
      extraversion: 'Extraversion',
      agreeableness: 'Agreeableness',
      neuroticism: 'Neuroticism',
    };
    for (const [key, label] of Object.entries(oceanTraits)) {
      html += `<tr><td>${label}</td><td>${profile.ocean[key] || 0}/100</td></tr>`;
    }
    html += `</table>`;
  }

  // Communication Guide
  if (profile?.communicationGuide) {
    html += `<h4>💬 How to Communicate With This Contact</h4>`;
    html += `<div style="background:#f0f7ff;padding:12px;border-radius:6px;border-left:4px solid #2563eb;">`;
    html += profile.communicationGuide;
    html += `</div>`;
  }

  // Do's and Don'ts
  if (profile?.dos && profile?.donts) {
    html += `<h4>✅ Do's</h4><ul>`;
    for (const d of profile.dos) html += `<li>${d}</li>`;
    html += `</ul>`;
    html += `<h4>❌ Don'ts</h4><ul>`;
    for (const d of profile.donts) html += `<li>${d}</li>`;
    html += `</ul>`;
  }

  // Key Interests
  if (profile?.interests?.length) {
    html += `<h4>🎯 Key Interests & Topics</h4><ul>`;
    for (const i of profile.interests) html += `<li>${i}</li>`;
    html += `</ul>`;
  }

  return {
    subject: `Enrichment Report — ${profile?.disc?.primary || 'Profile'} Type`,
    body: html,
  };
}

/**
 * Build a social listening alert Note (HTML).
 */
function buildAlertNote(alert) {
  let html = `<h3>🔔 Social Listening Alert</h3>`;
  html += `<p><strong>Detected:</strong> ${new Date().toISOString()}</p>`;
  html += `<p><strong>Signal Type:</strong> ${alert.signalType}</p>`;
  html += `<p><strong>Platform:</strong> ${alert.platform}</p>`;
  html += `<p><strong>Confidence:</strong> ${alert.confidence}%</p>`;

  html += `<div style="background:#fff7ed;padding:12px;border-radius:6px;border-left:4px solid #f59e0b;">`;
  html += `<p><strong>Summary:</strong> ${alert.summary}</p>`;
  if (alert.originalContent) {
    html += `<p><strong>Original Post:</strong> <em>"${alert.originalContent}"</em></p>`;
  }
  html += `</div>`;

  if (alert.suggestedAction) {
    html += `<h4>💡 Suggested Action</h4>`;
    html += `<p>${alert.suggestedAction}</p>`;
  }

  return {
    subject: `🔔 Alert: ${alert.signalType} — ${alert.platform}`,
    body: html,
  };
}

/**
 * Determine which tags to add based on enrichment results.
 */
function enrichmentToTags(profile, alerts = []) {
  const tags = ['Enriched'];

  if (profile?.disc?.primary) {
    tags.push(`DISC-${profile.disc.primary}`);
  }

  for (const alert of alerts) {
    if (alert.signalType === 'travel') tags.push('Travel-Detected');
    if (alert.signalType === 'property_interest') tags.push('Property-Interest');
    if (alert.signalType === 'in_area') tags.push('In-Area');
    if (alert.signalType === 'life_event') tags.push('Life-Event');
  }

  return [...new Set(tags)];
}

module.exports = {
  profileToCustomFields,
  socialLinksToCustomFields,
  enrichmentStatusFields,
  buildEnrichmentNote,
  buildAlertNote,
  enrichmentToTags,
};
