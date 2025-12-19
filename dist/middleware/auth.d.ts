/**
 * Auth Middleware Factory
 *
 * Creates JWT authentication middleware for Dodekatloi services.
 *
 * SECURITY NOTES:
 * - JWT is read ONLY from 'auth_token' HttpOnly cookie (never headers/query)
 * - Algorithm is hardcoded to HS256 (prevents algorithm confusion attacks)
 * - JWT secret is passed at runtime, never logged or stored
 * - Error messages are generic to prevent information leakage
 * - Login redirects use hubPublicUrl (never internal Docker URLs)
 */
import type { Context, MiddlewareHandler } from 'hono';
import type { AuthUser } from '../types/auth.js';
/**
 * Configuration for auth middleware factory
 */
export interface AuthMiddlewareConfig {
    /**
     * JWT secret for verifying tokens
     * MUST match the secret used by Hub to sign tokens
     */
    jwtSecret: string;
    /**
     * Public-facing Hub URL for login redirects
     * e.g., 'https://hub.davmanz.com' or 'http://localhost:6101'
     * NEVER use internal Docker URLs here (like 'http://hub:6100')
     */
    hubPublicUrl: string;
    /**
     * This service's public frontend URL for returnTo parameter
     * e.g., 'https://memo.davmanz.com' or 'http://localhost:6601'
     */
    frontendUrl: string;
}
/**
 * Return type from createAuthMiddleware factory
 */
export interface AuthMiddleware {
    /**
     * Middleware that requires authentication.
     * - API requests: Returns 401 with { error, loginUrl }
     * - Page requests: Redirects to Hub login with returnTo
     */
    requireAuth: MiddlewareHandler;
    /**
     * Middleware that optionally authenticates.
     * Sets user in context if valid token present, but doesn't block.
     */
    optionalAuth: MiddlewareHandler;
    /**
     * Get the current user from context (set by auth middleware)
     * Returns null if no user is authenticated
     */
    getUser: (c: Context) => AuthUser | null;
}
/**
 * Creates auth middleware for a Dodekatloi service
 *
 * @example
 * ```typescript
 * const { requireAuth, optionalAuth, getUser } = createAuthMiddleware({
 *   jwtSecret: env.jwtSecret,
 *   hubPublicUrl: env.hubPublicUrl,
 *   frontendUrl: env.frontendUrl,
 * });
 *
 * app.use('/api/*', requireAuth);
 * ```
 */
export declare function createAuthMiddleware(config: AuthMiddlewareConfig): AuthMiddleware;
export type { AuthUser } from '../types/auth.js';
//# sourceMappingURL=auth.d.ts.map