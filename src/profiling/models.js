/**
 * DISC/OCEAN Data Models
 *
 * Schema definitions and validation for personality profiles.
 * Also includes reference data for the DISC and OCEAN frameworks.
 */

// ─── DISC Framework Reference ───────────────────────────────────────────────

const DISC_TYPES = {
  D: {
    name: 'Dominance',
    description: 'Direct, decisive, competitive, results-oriented',
    strengths: ['Decision-making', 'Leadership', 'Problem-solving', 'Getting results'],
    challenges: ['Impatience', 'Insensitivity', 'Poor listening'],
    realEstateContext: {
      asBuyer: 'Wants to see the best options fast. Values ROI and investment potential. Makes quick decisions.',
      asSeller: 'Wants top dollar, fast timeline. Impatient with slow processes. Wants to be in control.',
      communication: 'Be direct and confident. Present clear options with data. Respect their time.',
      objectionHandling: 'Address head-on with facts. Never be evasive. Show you are competent.',
    },
  },
  I: {
    name: 'Influence',
    description: 'Enthusiastic, optimistic, collaborative, people-oriented',
    strengths: ['Networking', 'Enthusiasm', 'Creativity', 'Persuasion'],
    challenges: ['Disorganization', 'Overcommitting', 'Lack of follow-through'],
    realEstateContext: {
      asBuyer: 'Excited about possibilities. Loves the dream/vision. May need help narrowing down.',
      asSeller: 'Wants the home to shine. Values staging and presentation. Enjoys the social aspect.',
      communication: 'Be enthusiastic and personal. Share stories. Make the process exciting.',
      objectionHandling: 'Use social proof and testimonials. Appeal to their vision of the future.',
    },
  },
  S: {
    name: 'Steadiness',
    description: 'Patient, reliable, team-oriented, values stability',
    strengths: ['Loyalty', 'Patience', 'Supportiveness', 'Consistency'],
    challenges: ['Resistance to change', 'Difficulty saying no', 'Indecisiveness'],
    realEstateContext: {
      asBuyer: 'Prioritizes family and community. Wants a safe, stable neighborhood. Takes time to decide.',
      asSeller: 'Emotional about the home. Needs reassurance. Worried about disruption.',
      communication: 'Be warm and patient. Build trust over time. Never rush or pressure.',
      objectionHandling: 'Acknowledge their concerns. Provide reassurance. Offer to take things step by step.',
    },
  },
  C: {
    name: 'Conscientiousness',
    description: 'Analytical, detail-oriented, systematic, quality-focused',
    strengths: ['Accuracy', 'Analysis', 'Planning', 'Quality control'],
    challenges: ['Over-analysis', 'Perfectionism', 'Slow decision-making'],
    realEstateContext: {
      asBuyer: 'Researches extensively. Wants comps, inspection reports, HOA docs. Compares everything.',
      asSeller: 'Wants accurate pricing backed by data. Concerned about every detail of the listing.',
      communication: 'Provide thorough documentation. Be precise. Use data and market analysis.',
      objectionHandling: 'Present detailed evidence. Give them time to review. Never wing it.',
    },
  },
};

// ─── OCEAN Framework Reference ──────────────────────────────────────────────

const OCEAN_TRAITS = {
  openness: {
    name: 'Openness to Experience',
    high: 'Creative, curious, open to new ideas and experiences',
    low: 'Practical, conventional, prefers routine and familiarity',
    realEstateImpact: 'High: open to unique properties, fixer-uppers, new neighborhoods. Low: prefers traditional homes, established areas.',
  },
  conscientiousness: {
    name: 'Conscientiousness',
    high: 'Organized, disciplined, detail-oriented, reliable',
    low: 'Flexible, spontaneous, may miss details',
    realEstateImpact: 'High: wants thorough documentation, timelines, checklists. Low: may need more hand-holding on paperwork.',
  },
  extraversion: {
    name: 'Extraversion',
    high: 'Outgoing, energetic, talkative, seeks social interaction',
    low: 'Reserved, reflective, prefers written communication',
    realEstateImpact: 'High: enjoys open houses, in-person meetings, phone calls. Low: prefers email/text, virtual tours.',
  },
  agreeableness: {
    name: 'Agreeableness',
    high: 'Cooperative, trusting, helpful, avoids conflict',
    low: 'Competitive, skeptical, challenges others',
    realEstateImpact: 'High: easy to work with but may not advocate for themselves. Low: tough negotiator, questions everything.',
  },
  neuroticism: {
    name: 'Neuroticism',
    high: 'Anxious, emotionally reactive, worries about outcomes',
    low: 'Calm, emotionally stable, handles stress well',
    realEstateImpact: 'High: needs extra reassurance, may panic at inspection findings. Low: stays calm through the process.',
  },
};

// ─── Validation Schemas ─────────────────────────────────────────────────────

/**
 * Validate a complete profile object.
 */
function validateProfileSchema(profile) {
  const errors = [];

  // DISC validation
  if (!profile.disc) {
    errors.push('Missing disc object');
  } else {
    if (!['D', 'I', 'S', 'C'].includes(profile.disc.primary)) {
      errors.push(`Invalid DISC primary: ${profile.disc.primary}`);
    }
    if (profile.disc.scores) {
      for (const key of ['D', 'I', 'S', 'C']) {
        const val = profile.disc.scores[key];
        if (typeof val !== 'number' || val < 0 || val > 100) {
          errors.push(`Invalid DISC score for ${key}: ${val}`);
        }
      }
    } else {
      errors.push('Missing disc.scores');
    }
  }

  // OCEAN validation
  if (!profile.ocean) {
    errors.push('Missing ocean object');
  } else {
    for (const trait of ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']) {
      const val = profile.ocean[trait];
      if (typeof val !== 'number' || val < 0 || val > 100) {
        errors.push(`Invalid OCEAN ${trait}: ${val}`);
      }
    }
  }

  // Communication fields
  if (!profile.communicationGuide) errors.push('Missing communicationGuide');
  if (!profile.dos || !Array.isArray(profile.dos)) errors.push('Missing or invalid dos');
  if (!profile.donts || !Array.isArray(profile.donts)) errors.push('Missing or invalid donts');

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a default/empty profile structure.
 */
function createEmptyProfile() {
  return {
    disc: {
      primary: null,
      secondary: null,
      primaryLabel: null,
      scores: { D: 0, I: 0, S: 0, C: 0 },
      summary: '',
    },
    ocean: {
      openness: 0,
      conscientiousness: 0,
      extraversion: 0,
      agreeableness: 0,
      neuroticism: 0,
      summary: '',
    },
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
}

module.exports = {
  DISC_TYPES,
  OCEAN_TRAITS,
  validateProfileSchema,
  createEmptyProfile,
};
