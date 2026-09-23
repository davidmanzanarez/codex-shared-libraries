import type { Context } from 'hono';
/**
 * Options for getClientIP
 */
export interface ClientIPOptions {
    /**
     * Resolve the transport-level peer address for requests that carry no
     * proxy header. Without it, such requests resolve to '' in production.
     *
     * Server-to-server calls inside a private network never pass through the
     * reverse proxy, so they arrive without X-Forwarded-For; the socket
     * address is the only way to tell them apart from the outside world.
     *
     * On @hono/node-server, pass `nodeSocketAddress` from '@codex/shared/node'.
     */
    socketAddress?: (c: Context) => string | undefined;
}
/**
 * Strip the IPv4-mapped IPv6 prefix Node reports on dual-stack sockets
 * ('::ffff:172.18.0.5' -> '172.18.0.5') so the docker patterns can match.
 */
export declare function normalizeIP(ip: string): string;
/**
 * Extract client IP from request headers
 *
 * SECURITY: For X-Forwarded-For, we take the LAST IP because reverse proxies
 * typically append the real client IP. An attacker could prepend fake IPs,
 * but the proxy adds the real one at the end.
 *
 * Header priority: X-Forwarded-For (last) > X-Real-IP > socket address
 *
 * CF-Connecting-IP is deliberately NOT trusted: the suite is not behind
 * Cloudflare, so that header is fully attacker-controlled and allowed
 * rate-limit buckets to be spoofed per request.
 */
export declare function getClientIP(c: Context, options?: ClientIPOptions): string;
/**
 * Check if request is from the internal (private) network
 *
 * SECURITY: Only RFC 1918 ranges and loopback qualify; the previous
 * 172.x.x.x wildcard also matched public 172.0-15 and 172.32-255 space.
 * In dev mode, 'unknown' IPs are treated as internal for convenience.
 * Empty strings are never internal (fail-safe for production).
 * This classifies traffic for metrics; it is not an authorization check.
 */
export declare function isInternalRequest(ip: string): boolean;
//# sourceMappingURL=ip.d.ts.map