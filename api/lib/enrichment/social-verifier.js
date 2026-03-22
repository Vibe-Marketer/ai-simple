import crypto from 'crypto';

function md5(str) {
  return crypto.createHash('md5').update(str.trim().toLowerCase()).digest('hex');
}

export async function verifySocial(email) {
  const result = {
    gravatar_exists: false,
    gravatar_url: null,
    platforms_found: [],
  };

  if (!email) return result;

  const hash = md5(email);

  // Check Gravatar avatar (404 = no account)
  try {
    const avatarRes = await fetch(`https://gravatar.com/avatar/${hash}?d=404`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    });

    if (avatarRes.ok) {
      result.gravatar_exists = true;
      result.gravatar_url = `https://gravatar.com/avatar/${hash}`;

      // Try to get profile JSON for linked accounts
      try {
        const profileRes = await fetch(`https://gravatar.com/${hash}.json`, {
          signal: AbortSignal.timeout(3000),
        });

        if (profileRes.ok) {
          const data = await profileRes.json();
          const entry = data?.entry?.[0];

          if (entry) {
            // Extract verified accounts from Gravatar profile
            if (entry.accounts && Array.isArray(entry.accounts)) {
              for (const account of entry.accounts) {
                result.platforms_found.push({
                  platform: account.shortname || account.domain,
                  url: account.url,
                  username: account.username,
                  source: 'gravatar_profile',
                });
              }
            }

            // Extract profile URLs
            if (entry.profileUrl) {
              result.platforms_found.push({
                platform: 'gravatar',
                url: entry.profileUrl,
                source: 'gravatar_profile',
              });
            }

            // Photos might reveal other platform connections
            if (entry.urls && Array.isArray(entry.urls)) {
              for (const url of entry.urls) {
                result.platforms_found.push({
                  platform: url.title || 'website',
                  url: url.value,
                  source: 'gravatar_profile',
                });
              }
            }
          }
        }
      } catch {
        // Profile JSON not available — that's fine
      }
    }
  } catch {
    // Gravatar check failed — leave as false
  }

  return result;
}
