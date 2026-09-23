/**
 * Private (RFC 1918) IPv4 ranges plus loopback. Docker allocates its bridge
 * and user-defined networks from these, so an address in them means the
 * request originated inside the private network rather than at the edge.
 * Only 172.16.0.0/12 is private; 172.0-15.x and 172.32-255.x are public.
 */
function isPrivateIPv4(ip) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
    if (!m)
        return false;
    const [a, b, c, d] = m.slice(1).map(Number);
    if ([a, b, c, d].some(n => n > 255))
        return false;
    if (a === 10)
        return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31)
        return true; // 172.16.0.0/12
    if (a === 192 && b === 168)
        return true; // 192.168.0.0/16
    if (a === 127)
        return true; // 127.0.0.0/8
    return false;
}
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
 * Check if request is from the internal (private) network
 *
 * SECURITY: Only RFC 1918 ranges and loopback qualify; the previous
 * 172.x.x.x wildcard also matched public 172.0-15 and 172.32-255 space.
 * In dev mode, 'unknown' IPs are treated as internal for convenience.
 * Empty strings are never internal (fail-safe for production).
 * This classifies traffic for metrics; it is not an authorization check.
 */
export function isInternalRequest(ip) {
    // Empty IP is never internal (fail-safe)
    if (!ip)
        return false;
    // In dev mode, treat 'unknown' as internal (no proxy headers locally)
    if (isDev && ip === 'unknown')
        return true;
    const normalized = normalizeIP(ip);
    return normalized === '::1' || normalized === 'localhost' || isPrivateIPv4(normalized);
}
//# sourceMappingURL=ip.js.map