// Vercel Edge Middleware — rate limiting for API routes
// Uses standard Web APIs (no next/server — this is a plain static site, not Next.js)

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_STRICT = 10;  // form submissions
const MAX_REQUESTS_LINKS = 60;   // link clicks (higher — legitimate users click multiple links)

const rateLimitStore = new Map();

export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Shortlink rewrite: catch non-API, non-static paths and rewrite to track-redirect
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/_next/') && !pathname.includes('.')) {
    const knownPages = ['/mba', '/cabo', '/cre', '/trial', '/community', '/index', '/privacy', '/terms',
      '/cookies', '/disclaimer', '/refund', '/acceptable-use',
      '/employee-setup', '/welcome', '/thank-you', '/cabo-thanks', '/cre-thanks', '/sign-in'];
    if (!knownPages.includes(pathname) && pathname !== '/') {
      const slug = pathname.slice(1);
      // Preserve all query params (tracking params like e=, src=, utm_*)
      const params = new URLSearchParams(url.search);
      params.set('path', slug);
      const rewriteUrl = new URL(`/api/track-redirect?${params.toString()}`, request.url);
      return new Response(null, {
        status: 307,
        headers: { 'x-middleware-rewrite': rewriteUrl.toString() }
      });
    }
  }

  const strictPaths = ['/api/submit-lead', '/api/submit-cre-lead', '/api/send-cre-welcome'];
  const linkPaths = ['/api/track-redirect'];

  const isStrict = strictPaths.some(p => pathname.startsWith(p));
  const isLink = linkPaths.some(p => pathname.startsWith(p));

  if (!isStrict && !isLink) {
    return; // pass through
  }

  const MAX_REQUESTS = isStrict ? MAX_REQUESTS_STRICT : MAX_REQUESTS_LINKS;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const key = `${ip}:${pathname}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { windowStart: now, count: 1 });
    return; // pass through
  }

  if (record.count >= MAX_REQUESTS) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
      }
    );
  }

  record.count++;
  return; // pass through
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next|[^?]*\\.(?:html?|css|js|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)'
  ],
};
