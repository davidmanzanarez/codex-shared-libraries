import type { Context } from 'hono';
/**
 * Extract client IP from request headers
 *
 * SECURITY: For X-Forwarded-For, we take the LAST IP because reverse proxies
 * typically append the real client IP. An attacker could prepend fake IPs,
 * but the proxy adds the real one at the end.
 *
 * Header priority: X-Forwarded-For (last) > X-Real-IP
 *
 * CF-Connecting-IP is deliberately NOT trusted: the suite is not behind
 * Cloudflare, so that header is fully attacker-controlled and allowed
 * rate-limit buckets to be spoofed per request.
 */
export declare function getClientIP(c: Context): string;
/**
 * Check if request is from internal Docker network
 *
 * SECURITY: Only trusts actual Docker network IPs (172.x.x.x) or localhost.
 * In dev mode, 'unknown' IPs are treated as internal for convenience.
 * Empty strings are never internal (fail-safe for production).
 */
export declare function isInternalRequest(ip: string): boolean;
//# sourceMappingURL=ip.d.ts.map