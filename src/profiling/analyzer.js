/**
 * DISC/OCEAN Profiling Engine
 *
 * Uses OpenAI GPT to analyze social media data and generate:
 * 1. DISC personality profile (Dominance, Influence, Steadiness, Conscientiousness)
 * 2. OCEAN (Big Five) personality profile
 * 3. Communication coaching specific to real estate interactions
 * 4. Do's and Don'ts for engaging the contact
 * 5. Key interests and conversation starters
 *
 * The prompts are specifically tuned for real estate agent use cases.
 */

const SYSTEM_PROMPT = `You are an expert behavioral psychologist and communication coach specializing in the DISC and OCEAN (Big Five) personality frameworks. You work with real estate professionals to help them understand their clients' communication preferences and personality traits based on publicly available social media data.

Your analysis must be:
- Grounded in observable behavioral patterns from the provided data
- Practical and actionable for a real estate agent
- Specific to real estate interactions (buying, selling, investing)
- Honest about confidence levels — if data is limited, say so

You MUST respond in valid JSON format only. No markdown, no code blocks, just raw JSON.`;

const ANALYSIS_PROMPT = `Analyze the following social media data for a real estate contact and generate a comprehensive personality profile.

## Contact Information
Name: {{name}}
Email: {{email}}
Location: {{location}}
Company: {{company}}
Job Title: {{jobTitle}}

## Social Media Data
Bio/Headline: {{bio}}
{{#if linkedinSummary}}
LinkedIn Summary: {{linkedinSummary}}
{{/if}}

## Recent Social Activity
{{#each recentPosts}}
- [{{this.platform}}] {{this.content}}
{{/each}}

## Additional Context
{{additionalContext}}

---

Based on this data, provide a JSON response with this exact structure:

{
  "disc": {
    "primary": "D" | "I" | "S" | "C",
    "secondary": "D" | "I" | "S" | "C" | null,
    "primaryLabel": "Dominance" | "Influence" | "Steadiness" | "Conscientiousness",
    "scores": {
      "D": <0-100>,
      "I": <0-100>,
      "S": <0-100>,
      "C": <0-100>
    },
    "summary": "<2-3 sentence DISC summary>"
  },
  "ocean": {
    "openness": <0-100>,
    "conscientiousness": <0-100>,
    "extraversion": <0-100>,
    "agreeableness": <0-100>,
    "neuroticism": <0-100>,
    "summary": "<2-3 sentence OCEAN summary>"
  },
  "communicationStyle": "<one-line communication style label, e.g., 'Direct & Results-Oriented'>",
  "communicationGuide": "<detailed paragraph on how a real estate agent should communicate with this person — tone, pace, what to emphasize, how to present information, how to handle objections>",
  "dos": [
    "<specific do #1 for real estate context>",
    "<specific do #2>",
    "<specific do #3>",
    "<specific do #4>",
    "<specific do #5>"
  ],
  "donts": [
    "<specific don't #1 for real estate context>",
    "<specific don't #2>",
    "<specific don't #3>",
    "<specific don't #4>",
    "<specific don't #5>"
  ],
  "interests": [
    "<interest/topic #1>",
    "<interest/topic #2>",
    "<interest/topic #3>"
  ],
  "conversationStarters": [
    "<real estate relevant conversation starter #1>",
    "<starter #2>",
    "<starter #3>"
  ],
  "buyerSellerInsights": {
    "asABuyer": "<how this person likely behaves as a buyer — what they prioritize, how they make decisions>",
    "asASeller": "<how this person likely behaves as a seller — what they worry about, what motivates them>",
    "negotiationStyle": "<how they likely negotiate — aggressive, collaborative, analytical, etc.>",
    "decisionMakingSpeed": "fast" | "moderate" | "slow",
    "keyMotivators": ["<motivator 1>", "<motivator 2>", "<motivator 3>"]
  },
  "confidence": <0-100>,
  "dataQuality": "high" | "medium" | "low",
  "reasoning": "<brief explanation of what data points drove the analysis>"
}

Be specific and actionable. Every recommendation should be something a real estate agent can immediately use in their next interaction.`;

/**
 * Generate a DISC/OCEAN profile from social data using OpenAI.
 *
 * @param {Object} socialData - Aggregated social data from the scraper
 * @param {Object} contact - Contact info from FUB
 * @returns {Object} - Complete personality profile
 */
async function generateProfile(socialData, contact) {
  const OpenAI = require('openai');
  const client = new OpenAI();

  // Build the prompt with actual data
  const prompt = buildPrompt(socialData, contact);

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const raw = JSON.parse(content);
    const profile = normalizeProfile(raw);

    // Validate the profile structure
    validateProfile(profile);

    return profile;
  } catch (err) {
    console.error(`[Profiler] OpenAI analysis failed: ${err.message}`);
    throw err;
  }
}

/**
 * Generate a profile from minimal data (name + email only).
 * Uses a lighter prompt when social data is unavailable.
 */
async function generateMinimalProfile(contact) {
  const OpenAI = require('openai');
  const client = new OpenAI();

  const prompt = `I have very limited data on this contact. Please provide a baseline DISC/OCEAN profile based on what little we know, and flag the low confidence.

Name: ${contact.firstName || ''} ${contact.lastName || ''}
Email: ${contact.email || ''}
Phone: ${contact.phone || ''}
Source: ${contact.source || 'Unknown'}
Tags: ${(contact.tags || []).join(', ')}
Stage: ${contact.stage || 'Unknown'}

Provide the same JSON structure as before, but set confidence to a low value and dataQuality to "low". Focus the communication guide on safe, universally effective real estate communication strategies.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');

    const raw = JSON.parse(content);
    return normalizeProfile(raw);
  } catch (err) {
    console.error(`[Profiler] Minimal profile generation failed: ${err.message}`);
    throw err;
  }
}

/**
 * Build the analysis prompt from social data and contact info.
 */
function buildPrompt(socialData, contact) {
  const aggregated = socialData.aggregated || {};

  let prompt = ANALYSIS_PROMPT;

  // Replace template variables
  prompt = prompt.replace('{{name}}', `${contact.firstName || ''} ${contact.lastName || ''}`.trim());
  prompt = prompt.replace('{{email}}', contact.email || 'N/A');
  prompt = prompt.replace('{{location}}', aggregated.location || contact.location || 'Unknown');
  prompt = prompt.replace('{{company}}', aggregated.company || 'Unknown');
  prompt = prompt.replace('{{jobTitle}}', aggregated.jobTitle || 'Unknown');
  prompt = prompt.replace('{{bio}}', aggregated.bio || aggregated.headline || 'No bio available');

  // LinkedIn summary
  const linkedinSummary = socialData.linkedin?.summary || '';
  if (linkedinSummary) {
    prompt = prompt.replace('{{#if linkedinSummary}}', '');
    prompt = prompt.replace('{{/if}}', '');
    prompt = prompt.replace('{{linkedinSummary}}', linkedinSummary);
  } else {
    // Remove the conditional block
    prompt = prompt.replace(/{{#if linkedinSummary}}[\s\S]*?{{\/if}}/g, '');
  }

  // Recent posts
  const posts = (aggregated.recentPosts || []).slice(0, 15);
  if (posts.length > 0) {
    const postLines = posts.map(p => `- [${p.platform}] ${p.content}`).join('\n');
    prompt = prompt.replace(/{{#each recentPosts}}[\s\S]*?{{\/each}}/g, postLines);
  } else {
    prompt = prompt.replace(/{{#each recentPosts}}[\s\S]*?{{\/each}}/g, 'No recent posts available.');
  }

  // Additional context from platform-specific data
  const contextParts = [];
  if (socialData.linkedin?.skills?.length) {
    contextParts.push(`LinkedIn Skills: ${socialData.linkedin.skills.join(', ')}`);
  }
  if (socialData.instagram?.followerCount) {
    contextParts.push(`Instagram Followers: ${socialData.instagram.followerCount}`);
  }
  if (socialData.twitter?.followerCount) {
    contextParts.push(`X/Twitter Followers: ${socialData.twitter.followerCount}`);
  }
  if (contact.tags?.length) {
    contextParts.push(`FUB Tags: ${contact.tags.join(', ')}`);
  }
  if (contact.stage) {
    contextParts.push(`FUB Stage: ${contact.stage}`);
  }
  if (contact.source) {
    contextParts.push(`Lead Source: ${contact.source}`);
  }

  prompt = prompt.replace('{{additionalContext}}', contextParts.join('\n') || 'No additional context.');

  return prompt;
}

/**
 * Validate the profile structure has required fields.
 */
function validateProfile(profile) {
  if (!profile.disc) throw new Error('Missing DISC data');
  if (!profile.ocean) throw new Error('Missing OCEAN data');
  if (!profile.disc.primary) throw new Error('Missing DISC primary type');
  if (!profile.disc.scores) throw new Error('Missing DISC scores');
  if (typeof profile.ocean.openness !== 'number') throw new Error('Missing OCEAN openness score');

  // Ensure scores are in valid range
  for (const [key, val] of Object.entries(profile.disc.scores)) {
    if (typeof val !== 'number' || val < 0 || val > 100) {
      profile.disc.scores[key] = Math.max(0, Math.min(100, Number(val) || 50));
    }
  }
  for (const trait of ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']) {
    if (typeof profile.ocean[trait] !== 'number' || profile.ocean[trait] < 0 || profile.ocean[trait] > 100) {
      profile.ocean[trait] = Math.max(0, Math.min(100, Number(profile.ocean[trait]) || 50));
    }
  }
}

/**
 * Generate a quick communication tip based on DISC type.
 * Useful for inline display without the full profile.
 */
function getQuickTip(discPrimary) {
  const tips = {
    D: {
      label: 'Dominance',
      emoji: '🎯',
      quickTip: 'Be direct, focus on results and ROI. Skip small talk. Present options with clear bottom-line impact.',
      tone: 'Confident, concise, business-focused',
    },
    I: {
      label: 'Influence',
      emoji: '🌟',
      quickTip: 'Be enthusiastic and personal. Build rapport first. Use stories and social proof. Make it fun and exciting.',
      tone: 'Warm, energetic, story-driven',
    },
    S: {
      label: 'Steadiness',
      emoji: '🤝',
      quickTip: 'Be patient and supportive. Avoid pressure. Emphasize stability, community, and family. Give them time to decide.',
      tone: 'Calm, reassuring, patient',
    },
    C: {
      label: 'Conscientiousness',
      emoji: '📊',
      quickTip: 'Provide detailed data and comparisons. Be accurate and thorough. Use market stats, comps, and documentation.',
      tone: 'Precise, data-driven, thorough',
    },
  };
  return tips[discPrimary] || tips['S'];
}

/**
 * Normalize an LLM response into the expected profile structure.
 * Handles various response formats the LLM might return.
 */
function normalizeProfile(raw) {
  // If it already has the expected structure, return as-is
  if (raw.disc && raw.disc.primary && raw.disc.scores) return raw;

  const profile = {
    disc: { primary: null, secondary: null, primaryLabel: null, scores: { D: 50, I: 50, S: 50, C: 50 }, summary: '' },
    ocean: { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50, summary: '' },
    communicationStyle: '',
    communicationGuide: '',
    dos: [],
    donts: [],
    interests: [],
    conversationStarters: [],
    buyerSellerInsights: null,
    confidence: 0,
    dataQuality: 'low',
    reasoning: '',
  };

  // Handle nested personalityProfile format
  const pp = raw.personalityProfile || raw.personality_profile || raw;
  const discData = pp.DISC || pp.disc || {};
  const oceanData = pp.OCEAN || pp.ocean || {};

  // Extract DISC scores (handle both 0-100 and 0-5 scales)
  const dScores = discData.scores || {};
  const dRaw = {
    D: dScores.D ?? dScores.d ?? discData.Dominance ?? discData.dominance ?? 50,
    I: dScores.I ?? dScores.i ?? discData.Influence ?? discData.influence ?? 50,
    S: dScores.S ?? dScores.s ?? discData.Steadiness ?? discData.steadiness ?? 50,
    C: dScores.C ?? dScores.c ?? discData.Conscientiousness ?? discData.conscientiousness ?? 50,
  };

  // Normalize to 0-100 scale if values are small (0-5 or 0-10)
  const maxD = Math.max(...Object.values(dRaw));
  const scale = maxD <= 5 ? 20 : maxD <= 10 ? 10 : 1;
  profile.disc.scores = {
    D: Math.round(dRaw.D * scale),
    I: Math.round(dRaw.I * scale),
    S: Math.round(dRaw.S * scale),
    C: Math.round(dRaw.C * scale),
  };

  // Determine primary DISC type
  const discEntries = Object.entries(profile.disc.scores);
  discEntries.sort((a, b) => b[1] - a[1]);
  profile.disc.primary = discData.primary || discEntries[0][0];
  profile.disc.secondary = discData.secondary || discEntries[1][0];
  const labels = { D: 'Dominance', I: 'Influence', S: 'Steadiness', C: 'Conscientiousness' };
  profile.disc.primaryLabel = discData.primaryLabel || labels[profile.disc.primary] || '';
  profile.disc.summary = discData.summary || discData.notes || pp.notes || '';

  // Extract OCEAN scores
  const oRaw = {
    openness: oceanData.openness ?? oceanData.Openness ?? 50,
    conscientiousness: oceanData.conscientiousness ?? oceanData.Conscientiousness ?? 50,
    extraversion: oceanData.extraversion ?? oceanData.Extraversion ?? 50,
    agreeableness: oceanData.agreeableness ?? oceanData.Agreeableness ?? 50,
    neuroticism: oceanData.neuroticism ?? oceanData.Neuroticism ?? 50,
  };
  const maxO = Math.max(...Object.values(oRaw));
  const oScale = maxO <= 5 ? 20 : maxO <= 10 ? 10 : 1;
  for (const [k, v] of Object.entries(oRaw)) {
    profile.ocean[k] = Math.round(v * oScale);
  }
  profile.ocean.summary = oceanData.summary || '';

  // Communication guide
  const cg = raw.communicationGuide || raw.communication_guide || {};
  if (typeof cg === 'string') {
    profile.communicationGuide = cg;
  } else if (cg.overview || cg.recommendations) {
    profile.communicationGuide = [cg.overview, ...(cg.recommendations || [])].filter(Boolean).join('\n');
  }
  profile.communicationStyle = raw.communicationStyle || raw.communication_style || '';

  // Lists
  profile.dos = raw.dos || [];
  profile.donts = raw.donts || [];
  profile.interests = raw.interests || [];
  profile.conversationStarters = raw.conversationStarters || raw.conversation_starters || [];
  profile.buyerSellerInsights = raw.buyerSellerInsights || raw.buyer_seller_insights || null;
  profile.confidence = raw.confidence ?? pp.confidence ?? (pp.dataQuality === 'low' ? 15 : 50);
  profile.dataQuality = raw.dataQuality || pp.dataQuality || 'low';
  profile.reasoning = raw.reasoning || '';

  return profile;
}

module.exports = {
  generateProfile,
  generateMinimalProfile,
  getQuickTip,
  validateProfile,
  normalizeProfile,
  SYSTEM_PROMPT,
};
