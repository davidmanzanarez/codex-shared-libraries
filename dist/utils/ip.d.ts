import type { Context } from 'hono';
/**
 * Extract client IP from request headers
 * Checks Cloudflare, X-Forwarded-For, X-Real-IP in order
 */
export declare function getClientIP(c: Context): string;
/**
 * Check if request is from internal Docker network
 */
export declare function isInternalRequest(ip: string): boolean;
//# sourceMappingURL=ip.d.ts.map