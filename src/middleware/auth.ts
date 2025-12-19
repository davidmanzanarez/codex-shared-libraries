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
import type { Context, Next, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
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
   * e.g., 'https://hub.example.com' or 'http://localhost:6100'
   * NEVER use internal Docker URLs here (like 'http://hub:6100')
   */
  hubPublicUrl: string;

  /**
   * This service's public frontend URL for returnTo parameter
   * e.g., 'https://myapp.example.com' or 'http://localhost:3000'
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
export function createAuthMiddleware(config: AuthMiddlewareConfig): AuthMiddleware {
  const { jwtSecret, hubPublicUrl, frontendUrl } = config;

  // Validate config at creation time (fail fast)
  if (!jwtSecret) {
    throw new Error('AuthMiddleware: jwtSecret is required');
  }
  if (!hubPublicUrl) {
    throw new Error('AuthMiddleware: hubPublicUrl is required');
  }
  if (!frontendUrl) {
    throw new Error('AuthMiddleware: frontendUrl is required');
  }

  // Login URL uses public Hub URL (never internal Docker URLs)
  const loginUrl = `${hubPublicUrl}/api/auth/google`;

  /**
   * Middleware that requires authentication
   */
  const requireAuth: MiddlewareHandler = async (c: Context, next: Next) => {
    const token = getCookie(c, 'auth_token');

    if (!token) {
      // For API requests, return 401 JSON
      if (c.req.path.startsWith('/api/')) {
        return c.json({ error: 'Unauthorized', loginUrl }, 401);
      }
      // For page requests, redirect to Hub login
      const returnTo = encodeURIComponent(frontendUrl + c.req.path);
      return c.redirect(`${loginUrl}?returnTo=${returnTo}`);
    }

    try {
      // SECURITY: Algorithm is hardcoded to prevent algorithm confusion attacks
      const user = jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
      }) as AuthUser;
      c.set('user', user);
      await next();
    } catch {
      // SECURITY: Generic error message, no token details leaked
      if (c.req.path.startsWith('/api/')) {
        return c.json({ error: 'Invalid token', loginUrl }, 401);
      }
      const returnTo = encodeURIComponent(frontendUrl + c.req.path);
      return c.redirect(`${loginUrl}?returnTo=${returnTo}`);
    }
  };

  /**
   * Middleware that optionally authenticates
   */
  const optionalAuth: MiddlewareHandler = async (c: Context, next: Next) => {
    const token = getCookie(c, 'auth_token');

    if (token) {
      try {
        // SECURITY: Same algorithm restriction as requireAuth
        const user = jwt.verify(token, jwtSecret, {
          algorithms: ['HS256'],
        }) as AuthUser;
        c.set('user', user);
      } catch {
        // Invalid token, continue without user (don't block)
      }
    }

    await next();
  };

  /**
   * Get the current user from context
   */
  const getUser = (c: Context): AuthUser | null => {
    return c.get('user') || null;
  };

  return { requireAuth, optionalAuth, getUser };
}

// Re-export AuthUser type for convenience
export type { AuthUser } from '../types/auth.js';
