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
 * Extract client IP from request headers
 * Checks Cloudflare, X-Forwarded-For, X-Real-IP in order
 */
export function getClientIP(c: Context): string {
  const cfConnectingIP = c.req.header('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const realIP = c.req.header('x-real-ip');
  if (realIP) return realIP;

  return 'unknown';
}

/**
 * Check if request is from internal Docker network
 */
export function isInternalRequest(ip: string): boolean {
  return INTERNAL_IP_PATTERNS.some(pattern => pattern.test(ip));
}
