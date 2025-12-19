/**
 * Rate Limiting Middleware
 * Simple in-memory sliding window rate limiter
 *
 * Supports:
 * - Global rate limits (apply to all routes)
 * - Per-endpoint rate limits (override global for specific paths)
 */
import type { Context, Next } from 'hono';
import { getClientIP } from '../utils/ip.js';

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
  /** Skip rate limiting for certain requests */
  skip?: (c: Context) => boolean;
}

interface RateLimitEntry {
  timestamps: number[];
}

/**
 * Create a rate limit store
 * Each service should create its own store instance
 */
export function createRateLimitStore() {
  const store = new Map<string, RateLimitEntry>();

  // Clean up old entries periodically
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      // Remove timestamps older than 5 minutes
      entry.timestamps = entry.timestamps.filter(t => now - t < 5 * 60 * 1000);
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
function getConfigForPath(path: string, options: RateLimitOptions): RateLimitConfig {
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
function defaultKeyGenerator(c: Context): string {
  const ip = getClientIP(c);
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
export function rateLimiter(
  store: Map<string, RateLimitEntry>,
  options: RateLimitOptions
) {
  const keyGenerator = options.keyGenerator ?? defaultKeyGenerator;

  return async (c: Context, next: Next) => {
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
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

    // Check if over limit
    if (entry.timestamps.length >= config.limit) {
      const oldestInWindow = Math.min(...entry.timestamps);
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
export function createSimpleRateLimiter(config: RateLimitConfig) {
  const store = createRateLimitStore();
  return rateLimiter(store, { default: config });
}
