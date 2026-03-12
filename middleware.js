// Vercel Edge Middleware — rate limiting for API routes
import { NextResponse } from 'next/server';

// Simple in-memory rate limit using edge runtime
// Limits: 10 requests per minute per IP on lead submission endpoints
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;

// Use a Map stored in module scope (edge runtime shares state within a region)
const rateLimitStore = new Map();

function getRateLimitKey(ip, path) {
  return `${ip}:${path}`;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only rate limit lead submission endpoints
  const rateLimitedPaths = ['/api/submit-lead', '/api/submit-cre-lead', '/api/send-cre-welcome'];
  if (!rateLimitedPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const key = getRateLimitKey(ip, pathname);
  const now = Date.now();

  const record = rateLimitStore.get(key);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { windowStart: now, count: 1 });
    return NextResponse.next();
  }

  if (record.count >= MAX_REQUESTS) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60'
        }
      }
    );
  }

  record.count++;
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
