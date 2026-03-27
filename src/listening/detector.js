/**
 * Social Listening Signal Detector
 *
 * Monitors social media activity for real estate-relevant signals:
 * 1. TRAVEL — Contact is traveling or planning travel (potential relocation)
 * 2. IN_AREA — Contact is in or visiting the agent's market area
 * 3. PROPERTY_INTEREST — Contact is sharing/engaging with property content
 * 4. LIFE_EVENT — Major life changes (marriage, baby, job change, retirement)
 * 5. MARKET_SENTIMENT — Opinions about real estate market
 *
 * Uses both keyword matching (fast, cheap) and LLM analysis (deep, accurate).
 */

const SIGNAL_TYPES = {
  TRAVEL: 'travel',
  IN_AREA: 'in_area',
  PROPERTY_INTEREST: 'property_interest',
  LIFE_EVENT: 'life_event',
  MARKET_SENTIMENT: 'market_sentiment',
};

// ─── Keyword Patterns ───────────────────────────────────────────────────────

const KEYWORD_PATTERNS = {
  [SIGNAL_TYPES.TRAVEL]: {
    patterns: [
      /\b(traveling|travelling|headed|flying|driving)\s+(to|down to|up to|out to)\b/i,
      /\b(vacation|trip|getaway|road trip|visiting)\s+(in|to|at)\b/i,
      /\b(just (landed|arrived)|checking in at|at the airport)\b/i,
      /\b(exploring|visiting|staying in|hotel in|airbnb in)\b/i,
      /\b(can't wait to visit|planning a trip|booked (a |my )?(flight|hotel|trip))\b/i,
      /\b(spring break|summer vacation|winter getaway)\b/i,
    ],
    weight: 60,
  },
  [SIGNAL_TYPES.PROPERTY_INTEREST]: {
    patterns: [
      /\b(house hunting|looking for a (home|house|condo|apartment))\b/i,
      /\b(just (listed|sold)|new listing|open house|for sale)\b/i,
      /\b(real estate|property|mortgage|home loan|pre-?approved)\b/i,
      /\b(moving to|relocating|downsizing|upgrading)\b/i,
      /\b(dream home|starter home|investment property|rental property)\b/i,
      /\b(closing day|just closed|new homeowner|got the keys)\b/i,
      /\b(zillow|realtor\.com|redfin|trulia)\b/i,
      /\b(home (inspection|appraisal)|escrow|title company)\b/i,
      /\b(neighborhood|school district|walkability|commute)\b/i,
    ],
    weight: 80,
  },
  [SIGNAL_TYPES.LIFE_EVENT]: {
    patterns: [
      /\b(engaged|getting married|wedding|tying the knot)\b/i,
      /\b(expecting|pregnant|baby on the way|new (baby|addition))\b/i,
      /\b(new job|got promoted|starting at|joining|career change)\b/i,
      /\b(retiring|retirement|last day at work)\b/i,
      /\b(divorced|separation|starting over|fresh start)\b/i,
      /\b(empty nest|kids (moved out|off to college))\b/i,
      /\b(inheritance|estate|passed away)\b/i,
    ],
    weight: 70,
  },
  [SIGNAL_TYPES.MARKET_SENTIMENT]: {
    patterns: [
      /\b(housing market|real estate market|home prices|interest rates)\b/i,
      /\b(buyer'?s market|seller'?s market|market crash|bubble)\b/i,
      /\b(good time to (buy|sell)|should (I|we) (buy|sell))\b/i,
      /\b(mortgage rates|fed rate|housing inventory)\b/i,
    ],
    weight: 50,
  },
};

/**
 * Scan a single post for keyword-based signals.
 *
 * @param {string} content - Post text content
 * @param {string} platform - Source platform
 * @returns {Array<Object>} - Detected signals
 */
function scanForKeywords(content, platform) {
  const signals = [];
  if (!content || typeof content !== 'string') return signals;

  for (const [signalType, config] of Object.entries(KEYWORD_PATTERNS)) {
    for (const pattern of config.patterns) {
      const match = content.match(pattern);
      if (match) {
        signals.push({
          signalType,
          platform,
          matchedPattern: match[0],
          confidence: config.weight,
          content: content.substring(0, 300),
          detectedAt: new Date().toISOString(),
        });
        break; // One match per signal type per post
      }
    }
  }

  return signals;
}

/**
 * Check if a post mentions a specific geographic area.
 *
 * @param {string} content - Post text
 * @param {Array<string>} targetAreas - List of areas to watch (cities, neighborhoods, zip codes)
 * @returns {Object|null} - IN_AREA signal or null
 */
function checkForAreaMention(content, targetAreas) {
  if (!content || !targetAreas?.length) return null;

  const contentLower = content.toLowerCase();
  for (const area of targetAreas) {
    const areaLower = area.toLowerCase();
    if (contentLower.includes(areaLower)) {
      return {
        signalType: SIGNAL_TYPES.IN_AREA,
        matchedArea: area,
        confidence: 75,
        content: content.substring(0, 300),
        detectedAt: new Date().toISOString(),
      };
    }
  }
  return null;
}

/**
 * Use LLM to perform deep analysis of social content for signals.
 * This is more expensive but catches nuanced signals that keywords miss.
 *
 * @param {Array<Object>} posts - Recent posts to analyze
 * @param {Object} context - { contactName, agentArea, agentSpecialties }
 * @returns {Array<Object>} - Detected signals with LLM reasoning
 */
async function deepAnalyze(posts, context) {
  if (!posts?.length) return [];

  const OpenAI = require('openai');
  const client = new OpenAI();

  const postsText = posts
    .map((p, i) => `[${i + 1}] [${p.platform}] ${p.content}`)
    .join('\n\n');

  const prompt = `You are a social media analyst working for a real estate agent. Analyze the following recent social media posts from a contact and identify any signals that are relevant for real estate engagement.

## Agent Context
Agent's Market Area: ${context.agentArea || 'Not specified'}
Agent's Specialties: ${(context.agentSpecialties || []).join(', ') || 'General residential'}

## Contact's Recent Posts
${postsText}

## Signal Types to Detect
1. TRAVEL — They are traveling, planning travel, or visiting somewhere (could indicate relocation interest)
2. IN_AREA — They are in or visiting the agent's market area
3. PROPERTY_INTEREST — They are engaging with property/real estate content, house hunting, or sharing listings
4. LIFE_EVENT — Major life changes that often trigger real estate transactions (marriage, baby, job change, retirement, divorce)
5. MARKET_SENTIMENT — They are expressing opinions about the real estate market

For each signal detected, respond with a JSON array:
[
  {
    "signalType": "travel" | "in_area" | "property_interest" | "life_event" | "market_sentiment",
    "postIndex": <which post number>,
    "confidence": <0-100>,
    "summary": "<one sentence summary of what was detected>",
    "suggestedAction": "<what the agent should do about this signal>",
    "urgency": "high" | "medium" | "low"
  }
]

If no signals are detected, return an empty array [].
Only return signals you are genuinely confident about. Do not fabricate signals.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a social media analyst for real estate professionals. Respond only with valid JSON arrays. Be conservative — only flag genuine signals.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    // Handle both { signals: [...] } and [...] formats
    const signals = Array.isArray(parsed) ? parsed : (parsed.signals || []);

    // Enrich with post content
    return signals.map(signal => ({
      ...signal,
      platform: posts[signal.postIndex - 1]?.platform || 'unknown',
      originalContent: posts[signal.postIndex - 1]?.content?.substring(0, 300) || '',
      detectedAt: new Date().toISOString(),
      method: 'llm',
    }));
  } catch (err) {
    console.error(`[Detector] LLM analysis failed: ${err.message}`);
    return [];
  }
}

/**
 * Run the complete signal detection pipeline on a contact's social data.
 *
 * @param {Object} socialData - From the scraper
 * @param {Object} config - { targetAreas, agentArea, agentSpecialties, useLLM }
 * @returns {Array<Object>} - All detected signals, deduplicated and ranked
 */
async function detectSignals(socialData, config = {}) {
  const allSignals = [];
  const posts = socialData?.aggregated?.recentPosts || [];

  // Phase 1: Fast keyword scanning
  for (const post of posts) {
    const keywordSignals = scanForKeywords(post.content, post.platform);
    allSignals.push(...keywordSignals);

    // Check for area mentions
    if (config.targetAreas?.length) {
      const areaSignal = checkForAreaMention(post.content, config.targetAreas);
      if (areaSignal) {
        areaSignal.platform = post.platform;
        allSignals.push(areaSignal);
      }
    }
  }

  // Phase 2: Deep LLM analysis (if enabled and there are posts)
  if (config.useLLM !== false && posts.length > 0) {
    const llmSignals = await deepAnalyze(posts, {
      agentArea: config.agentArea,
      agentSpecialties: config.agentSpecialties,
    });
    allSignals.push(...llmSignals);
  }

  // Deduplicate and rank
  return deduplicateSignals(allSignals);
}

/**
 * Deduplicate signals, keeping the highest confidence version.
 */
function deduplicateSignals(signals) {
  const byType = {};
  for (const signal of signals) {
    const key = `${signal.signalType}_${signal.platform}`;
    if (!byType[key] || signal.confidence > byType[key].confidence) {
      byType[key] = signal;
    }
  }
  return Object.values(byType).sort((a, b) => b.confidence - a.confidence);
}

/**
 * Generate a suggested action for the agent based on a signal.
 */
function getSuggestedAction(signal) {
  const actions = {
    [SIGNAL_TYPES.TRAVEL]: `Reach out casually: "I saw you might be traveling — if you're ever checking out the area, I'd love to show you around!"`,
    [SIGNAL_TYPES.IN_AREA]: `Send a timely message: "Welcome to the area! Let me know if you'd like any local recommendations or want to see what's on the market."`,
    [SIGNAL_TYPES.PROPERTY_INTEREST]: `Engage directly: "I noticed you might be exploring real estate options — I'd love to help. Want me to send you some listings that match what you're looking for?"`,
    [SIGNAL_TYPES.LIFE_EVENT]: `Send a thoughtful message acknowledging their life change and gently offer your services if their housing needs might be changing.`,
    [SIGNAL_TYPES.MARKET_SENTIMENT]: `Share your market expertise: "Great observation about the market! Here's what I'm seeing locally..."`,
  };
  return signal.suggestedAction || actions[signal.signalType] || 'Follow up with a personalized message.';
}

module.exports = {
  SIGNAL_TYPES,
  KEYWORD_PATTERNS,
  scanForKeywords,
  checkForAreaMention,
  deepAnalyze,
  detectSignals,
  deduplicateSignals,
  getSuggestedAction,
};
