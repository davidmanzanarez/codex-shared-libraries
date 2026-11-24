/**
 * Auth Routes Factory
 * Creates standard auth endpoints that proxy to Hub
 */
import { Hono } from 'hono';
export declare const DEFAULT_REFRESH_COOKIE_NAME = "ddk_refresh";
export declare const DEFAULT_REFRESH_MAX_AGE: number;
export interface AuthRoutesConfig {
    /**
     * JWT secret for verifying tokens
     * MUST match the secret used by Hub to sign tokens
     */
    jwtSecret: string;
    /**
     * Hub's public URL for OAuth redirects
     * e.g., 'https://hub.example.com' or 'http://localhost:6100'
     */
    hubPublicUrl: string;
    /**
     * This service's public API URL for the callback
     * e.g., 'https://api.example.com' or 'http://localhost:6300'
     */
    selfUrl: string;
    /**
     * Frontend URL to redirect after login/logout
     * e.g., 'https://app.example.com' or 'http://localhost:6301'
     */
    frontendUrl: string;
    /**
     * Whether running in production (affects cookie security)
     * Default: process.env.NODE_ENV === 'production'
     */
    isProduction?: boolean;
    /**
     * Cookie max age in seconds
     * Default: 7 days (604800 seconds)
     */
    cookieMaxAge?: number;
    /**
     * Cookie domain for cross-subdomain auth
     * e.g., '.example.com' to share cookie across all subdomains
     * IMPORTANT: Must match Hub's cookie domain for logout to work properly
     */
    cookieDomain?: string;
    /**
     * Hub's internal URL for server-to-server session refresh and revocation
     * e.g., 'http://hub:6100' or 'http://localhost:6100'
     * When set alongside hubSecret, enables POST /refresh and transparent
     * auto-refresh in GET /me when auth_token is expired/missing and the
     * refresh cookie is present.
     */
    hubInternalUrl?: string;
    /**
     * Shared secret sent as X-Hub-Secret when calling Hub internal session endpoints.
     */
    hubSecret?: string;
    /**
     * Refresh cookie name (must match Hub). Default: 'ddk_refresh'.
     */
    refreshCookieName?: string;
    /**
     * Refresh cookie max age in seconds. Default: 365 days.
     */
    refreshCookieMaxAge?: number;
    /**
     * Timeout in milliseconds for internal Hub refresh/revoke calls. Default: 5000.
     */
    refreshTimeoutMs?: number;
    /**
     * Optional fetch implementation (injectable for tests; defaults to globalThis.fetch).
     */
    fetchFn?: typeof fetch;
}
/**
 * Create auth routes that proxy to Hub
 *
 * @example
 * ```typescript
 * import { createAuthRoutes } from '@codex/shared';
 *
 * const authRoutes = createAuthRoutes({
 *   jwtSecret: env.jwtSecret,
 *   hubPublicUrl: env.hubPublicUrl,
 *   hubInternalUrl: env.hubUrl,
 *   hubSecret: env.hubSecret,
 *   selfUrl: env.selfUrl,
 *   frontendUrl: env.frontendUrl,
 * });
 *
 * app.route('/api/auth', authRoutes);
 * ```
 *
 * This creates:
 * - GET /api/auth/me - Check if user is authenticated (auto-refreshes via Hub if configured)
 * - POST /api/auth/refresh - Exchange refresh cookie for fresh access + rotated refresh cookies
 * - GET /api/auth/login - Redirect to Hub login
 * - GET /api/auth/callback - Receive token from Hub
 * - POST /api/auth/logout - Clear auth cookies (and revoke refresh session on Hub)
 */
export declare function createAuthRoutes(config: AuthRoutesConfig): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=auth.d.ts.map