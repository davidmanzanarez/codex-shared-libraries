/**
 * @codex/shared/node - adapters that need the Node runtime
 *
 * Kept on its own subpath so the core package stays runtime-agnostic:
 * importing this entry point requires @hono/node-server (optional peer).
 */
import type { Context } from 'hono';
/**
 * Peer (socket) address of the current request under @hono/node-server.
 * Pass as `socketAddress` to getClientIP, or as `resolveIP` to the
 * metrics/rate-limit middleware, so proxy-less internal calls resolve to
 * their real network address instead of ''.
 */
export declare function nodeSocketAddress(c: Context): string | undefined;
//# sourceMappingURL=index.d.ts.map