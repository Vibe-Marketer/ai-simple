/**
 * Lightweight regex-based User-Agent parser.
 * No npm dependencies. ~95% accuracy on common browsers/devices.
 */

/**
 * Parse a User-Agent string into device, OS, and browser info.
 * @param {string} ua - User-Agent header string
 * @returns {{ device_type: string, os: string|null, browser: string|null }}
 */
export function parseUserAgent(ua) {
  if (!ua || typeof ua !== 'string') {
    return { device_type: 'desktop', os: null, browser: null };
  }

  const device_type = detectDeviceType(ua);
  const os = detectOS(ua);
  const browser = detectBrowser(ua);

  return { device_type, os, browser };
}

function detectDeviceType(ua) {
  // Tablets first (before mobile, since some tablet UAs contain "Mobile")
  if (/iPad|tablet|Kindle|Silk|PlayBook/i.test(ua)) return 'tablet';
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet';

  // Mobile
  if (/Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Opera Mini|Opera Mobi|IEMobile|Windows Phone/i.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
}

function detectOS(ua) {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/CrOS/i.test(ua)) return 'Chrome OS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return null;
}

function detectBrowser(ua) {
  // Order matters: check more specific browsers before generic ones
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/OPR|Opera/i.test(ua)) return 'Opera';
  if (/Edg/i.test(ua)) return 'Edge';
  if (/Firefox|FxiOS/i.test(ua)) return 'Firefox';
  if (/CriOS/i.test(ua)) return 'Chrome'; // Chrome on iOS
  if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  return null;
}
