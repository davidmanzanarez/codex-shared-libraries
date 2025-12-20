/**
 * Auth Routes Factory
 * Creates standard auth endpoints that proxy to Hub
 *
 * SECURITY NOTES:
 * - Token is received via query param from Hub (trusted internal redirect)
 * - Token is verified before setting cookie
 * - Algorithm hardcoded to HS256 (prevents algorithm confusion)
 * - Cookie is HttpOnly, Secure in production, SameSite=Lax
 * - Generic error messages to prevent information leakage
 */
import { Hono } from 'hono';
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
 *   selfUrl: env.selfUrl,
 *   frontendUrl: env.frontendUrl,
 * });
 *
 * app.route('/api/auth', authRoutes);
 * ```
 *
 * This creates:
 * - GET /api/auth/me - Check if user is authenticated
 * - GET /api/auth/login - Redirect to Hub login
 * - GET /api/auth/callback - Receive token from Hub
 * - POST /api/auth/logout - Clear auth cookie
 */
export declare function createAuthRoutes(config: AuthRoutesConfig): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=auth.d.ts.map