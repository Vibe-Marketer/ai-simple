export function calculateScore({ email, phone, domain, social }) {
  const breakdown = {};
  let score = 0;

  // Email signals (max 40)
  if (email?.valid === true) {
    breakdown.email_mx_exists = 15;
    score += 15;
  }

  if (email?.is_disposable === false) {
    breakdown.email_not_disposable = 10;
    score += 10;
  }

  if (email?.smtp_verified === true) {
    breakdown.email_smtp_verified = 10;
    score += 10;
  }

  if (email?.is_catchall === false) {
    breakdown.email_not_catchall = 5;
    score += 5;
  }

  // Phone signals (max 15)
  if (phone?.valid === true) {
    breakdown.phone_valid = 10;
    score += 10;
  }

  if (phone?.type === 'mobile') {
    breakdown.phone_is_mobile = 5;
    score += 5;
  }

  // Domain signals (max 35)
  if (domain?.has_website === true) {
    breakdown.domain_has_website = 15;
    score += 15;
  }

  if (domain?.schema_org && Object.keys(domain.schema_org).length > 0) {
    breakdown.schema_org_found = 5;
    score += 5;

    // Check for business-type schema (Organization, LocalBusiness, etc.)
    const schemaTypes = JSON.stringify(domain.schema_org).toLowerCase();
    if (schemaTypes.includes('organization') ||
        schemaTypes.includes('localbusiness') ||
        schemaTypes.includes('corporation') ||
        schemaTypes.includes('professionalservice')) {
      breakdown.business_schema = 10;
      score += 10;
    }
  }

  if (domain?.social_links && Object.keys(domain.social_links).length > 0) {
    breakdown.social_links_on_site = 5;
    score += 5;
  }

  if (domain?.tech_stack && Object.keys(domain.tech_stack).length > 0) {
    breakdown.tech_stack_detected = 5;
    score += 5;
  }

  // Social signals (max 5)
  if (social?.gravatar_exists === true) {
    breakdown.gravatar_exists = 5;
    score += 5;
  }

  // Cap at 100
  score = Math.min(score, 100);

  return { score, breakdown };
}
