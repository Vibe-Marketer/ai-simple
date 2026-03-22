import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function verifyPhone(phone) {
  const result = {
    valid: false,
    type: null,
    country: null,
    formatted: null,
  };

  if (!phone) return result;

  // Clean up common formatting issues
  let cleaned = phone.toString().trim();
  // Add + prefix if it looks like a full international number without it
  if (/^\d{10,15}$/.test(cleaned) && cleaned.length > 10) {
    cleaned = '+' + cleaned;
  }

  // Try parsing with US default (most leads are US-based)
  const parsed = parsePhoneNumberFromString(cleaned, 'US');

  if (!parsed) return result;

  result.valid = parsed.isValid();
  result.formatted = parsed.format('E.164');
  result.country = parsed.country || null;

  // Detect number type
  const type = parsed.getType();
  if (type) {
    const typeMap = {
      'MOBILE': 'mobile',
      'FIXED_LINE': 'fixed_line',
      'FIXED_LINE_OR_MOBILE': 'mobile_or_fixed',
      'VOIP': 'voip',
      'TOLL_FREE': 'toll_free',
      'PREMIUM_RATE': 'premium',
      'PERSONAL_NUMBER': 'personal',
      'PAGER': 'pager',
      'UAN': 'uan',
    };
    result.type = typeMap[type] || type.toLowerCase();
  }

  return result;
}
