import type { Context } from 'hono';

/**
 * Internal Docker network IP patterns
 * 172.x.x.x are Docker bridge networks
 */
const INTERNAL_IP_PATTERNS = [
  /^172\.\d+\.\d+\.\d+$/,
  /^127\.0\.0\.1$/,
  /^localhost$/,
  /^::1$/,
];

/**
 * Check if we're in development mode (no reverse proxy)
 */
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Extract client IP from request headers
 *
 * SECURITY: For X-Forwarded-For, we take the LAST IP because reverse proxies
 * typically append the real client IP. An attacker could prepend fake IPs,
 * but the proxy adds the real one at the end.
 *
 * Header priority: CF-Connecting-IP > X-Forwarded-For (last) > X-Real-IP
 */
export function getClientIP(c: Context): string {
  // Cloudflare (trusted, single value)
  const cfConnectingIP = c.req.header('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  // Reverse proxy - take LAST IP (proxy appends real client IP)
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[ips.length - 1];
  }

  const realIP = c.req.header('x-real-ip');
  if (realIP) return realIP;

  // No proxy headers - dev mode returns 'unknown', production fails safe
  return isDev ? 'unknown' : '';
}

/**
 * Check if request is from internal Docker network
 *
 * SECURITY: Only trusts actual Docker network IPs (172.x.x.x) or localhost.
 * In dev mode, 'unknown' IPs are treated as internal for convenience.
 * Empty strings are never internal (fail-safe for production).
 */
export function isInternalRequest(ip: string): boolean {
  // Empty IP is never internal (fail-safe)
  if (!ip) return false;

  // In dev mode, treat 'unknown' as internal (no proxy headers locally)
  if (isDev && ip === 'unknown') return true;

  return INTERNAL_IP_PATTERNS.some(pattern => pattern.test(ip));
}
