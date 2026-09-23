import { getClientIP } from '../utils/ip.js';
/** Window assumed for entries that predate windowMs tracking */
const DEFAULT_CLEANUP_WINDOW_MS = 5 * 60 * 1000;
/**
 * Create a rate limit store
 * Each service should create its own store instance
 */
export function createRateLimitStore() {
    const store = new Map();
    // Clean up old entries periodically
    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store.entries()) {
            // Drop timestamps outside the entry's own window. A fixed 5-minute
            // sweep used to silently under-count any limit configured with a
            // longer window (e.g. 10 imports per hour).
            const windowMs = entry.windowMs || DEFAULT_CLEANUP_WINDOW_MS;
            entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
            if (entry.timestamps.length === 0) {
                store.delete(key);
            }
        }
    }, 60 * 1000); // Clean up every minute
    // Prevent interval from keeping process alive
    cleanup.unref?.();
    return store;
}
/**
 * Get the rate limit config for a given path
 */
function getConfigForPath(path, options) {
    if (options.endpoints) {
        // Find the most specific matching endpoint
        const matchingPaths = Object.keys(options.endpoints)
            .filter(prefix => path.startsWith(prefix))
            .sort((a, b) => b.length - a.length); // Longest match first
        if (matchingPaths.length > 0) {
            return options.endpoints[matchingPaths[0]];
        }
    }
    return options.default;
}
/**
 * Default key generator: IP + path prefix (first 3 segments)
 */
function defaultKeyGenerator(c, resolveIP) {
    const ip = resolveIP(c);
    const path = c.req.path;
    const pathPrefix = path.split('/').slice(0, 3).join('/');
    return `${ip}:${pathPrefix}`;
}
/**
 * Create rate limiter middleware
 *
 * @example
 * // Simple usage with default config
 * const store = createRateLimitStore();
 * app.use('/api/*', rateLimiter(store, { default: { limit: 100, window: 60 } }));
 *
 * @example
 * // With per-endpoint overrides
 * app.use('/api/*', rateLimiter(store, {
 *   default: { limit: 100, window: 60 },
 *   endpoints: {
 *     '/api/auth': { limit: 10, window: 60 },      // Stricter for auth
 *     '/api/import': { limit: 5, window: 300 },    // Very strict for imports
 *   }
 * }));
 */
export function rateLimiter(store, options) {
    const resolveIP = options.resolveIP ?? getClientIP;
    const keyGenerator = options.keyGenerator ?? ((c) => defaultKeyGenerator(c, resolveIP));
    return async (c, next) => {
        // Check if we should skip rate limiting
        if (options.skip?.(c)) {
            return next();
        }
        const path = c.req.path;
        const config = getConfigForPath(path, options);
        const key = keyGenerator(c);
        const now = Date.now();
        const windowMs = config.window * 1000;
        // Get or create entry
        let entry = store.get(key);
        if (!entry) {
            entry = { timestamps: [], windowMs };
            store.set(key, entry);
        }
        entry.windowMs = windowMs;
        // Remove timestamps outside the window
        entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
        // Check if over limit
        if (entry.timestamps.length >= config.limit) {
            // Timestamps are appended in order, so the first one is the oldest.
            // (Math.min(...arr) would also overflow the call stack on large limits.)
            const oldestInWindow = entry.timestamps[0];
            const resetIn = Math.ceil((oldestInWindow + windowMs - now) / 1000);
            c.header('X-RateLimit-Limit', config.limit.toString());
            c.header('X-RateLimit-Remaining', '0');
            c.header('X-RateLimit-Reset', resetIn.toString());
            c.header('Retry-After', resetIn.toString());
            return c.json({
                error: 'Too many requests',
                retryAfter: resetIn,
            }, 429);
        }
        // Add current request timestamp
        entry.timestamps.push(now);
        // Set rate limit headers
        c.header('X-RateLimit-Limit', config.limit.toString());
        c.header('X-RateLimit-Remaining', (config.limit - entry.timestamps.length).toString());
        await next();
    };
}
/**
 * Simple rate limiter factory for backwards compatibility
 * Creates a store and returns a middleware with basic config
 */
export function createSimpleRateLimiter(config) {
    const store = createRateLimitStore();
    return rateLimiter(store, { default: config });
}
//# sourceMappingURL=rateLimit.js.map