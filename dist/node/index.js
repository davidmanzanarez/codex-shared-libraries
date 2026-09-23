import { getConnInfo } from '@hono/node-server/conninfo';
/**
 * Peer (socket) address of the current request under @hono/node-server.
 * Pass as `socketAddress` to getClientIP, or as `resolveIP` to the
 * metrics/rate-limit middleware, so proxy-less internal calls resolve to
 * their real network address instead of ''.
 */
export function nodeSocketAddress(c) {
    try {
        return getConnInfo(c).remote.address;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=index.js.map