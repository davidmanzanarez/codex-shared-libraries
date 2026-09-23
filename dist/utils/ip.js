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
 * Strip the IPv4-mapped IPv6 prefix Node reports on dual-stack sockets
 * ('::ffff:172.18.0.5' -> '172.18.0.5') so the docker patterns can match.
 */
export function normalizeIP(ip) {
    return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}
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
export function getClientIP(c, options) {
    // Reverse proxy - take LAST IP (proxy appends real client IP)
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) {
        const ips = forwarded.split(',').map(ip => ip.trim());
        return normalizeIP(ips[ips.length - 1]);
    }
    const realIP = c.req.header('x-real-ip');
    if (realIP)
        return normalizeIP(realIP);
    // No proxy headers: fall back to the peer address when the caller can
    // supply it (server-to-server traffic that bypassed the proxy).
    const socket = options?.socketAddress?.(c);
    if (socket)
        return normalizeIP(socket);
    // Otherwise dev mode returns 'unknown', production fails safe
    return isDev ? 'unknown' : '';
}
/**
 * Check if request is from internal Docker network
 *
 * SECURITY: Only trusts actual Docker network IPs (172.x.x.x) or localhost.
 * In dev mode, 'unknown' IPs are treated as internal for convenience.
 * Empty strings are never internal (fail-safe for production).
 */
export function isInternalRequest(ip) {
    // Empty IP is never internal (fail-safe)
    if (!ip)
        return false;
    // In dev mode, treat 'unknown' as internal (no proxy headers locally)
    if (isDev && ip === 'unknown')
        return true;
    const normalized = normalizeIP(ip);
    return INTERNAL_IP_PATTERNS.some(pattern => pattern.test(normalized));
}
//# sourceMappingURL=ip.js.map