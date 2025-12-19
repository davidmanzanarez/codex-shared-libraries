import type { Context } from 'hono';
/**
 * Extract client IP from request headers
 *
 * SECURITY: For X-Forwarded-For, we take the LAST IP because reverse proxies
 * typically append the real client IP. An attacker could prepend fake IPs,
 * but the proxy adds the real one at the end.
 *
 * Header priority: CF-Connecting-IP > X-Forwarded-For (last) > X-Real-IP
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