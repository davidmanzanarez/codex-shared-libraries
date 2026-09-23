/**
 * Rate Limiting Middleware
 * Simple in-memory sliding window rate limiter
 *
 * Supports:
 * - Global rate limits (apply to all routes)
 * - Per-endpoint rate limits (override global for specific paths)
 */
import type { Context, Next } from 'hono';
export interface RateLimitConfig {
    /** Max requests per window */
    limit: number;
    /** Window size in seconds */
    window: number;
}
export interface RateLimitOptions {
    /** Default rate limit for all routes */
    default: RateLimitConfig;
    /** Per-endpoint overrides (path prefix -> config) */
    endpoints?: Record<string, RateLimitConfig>;
    /** Custom key generator (default: IP + path prefix) */
    keyGenerator?: (c: Context) => string;
    /**
     * Client-IP resolver for the default key (default: getClientIP from proxy
     * headers). Ignored when keyGenerator is set.
     */
    resolveIP?: (c: Context) => string;
    /** Skip rate limiting for certain requests */
    skip?: (c: Context) => boolean;
}
export interface RateLimitEntry {
    /** Request timestamps (ms) inside the current window, oldest first */
    timestamps: number[];
    /** Window size (ms) of the config that last touched this entry */
    windowMs: number;
}
/** In-memory store shared by every rateLimiter() mounted on one service */
export type RateLimitStore = Map<string, RateLimitEntry>;
/**
 * Create a rate limit store
 * Each service should create its own store instance
 */
export declare function createRateLimitStore(): RateLimitStore;
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
export declare function rateLimiter(store: RateLimitStore, options: RateLimitOptions): (c: Context, next: Next) => Promise<void | (Response & import("hono").TypedResponse<{
    error: string;
    retryAfter: number;
}, 429, "json">)>;
/**
 * Simple rate limiter factory for backwards compatibility
 * Creates a store and returns a middleware with basic config
 */
export declare function createSimpleRateLimiter(config: RateLimitConfig): (c: Context, next: Next) => Promise<void | (Response & import("hono").TypedResponse<{
    error: string;
    retryAfter: number;
}, 429, "json">)>;
//# sourceMappingURL=rateLimit.d.ts.map