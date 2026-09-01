import { getCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
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
export function createAuthMiddleware(config) {
    const { jwtSecret, hubPublicUrl, frontendUrl, ownerUserId } = config;
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
    const requireAuth = async (c, next) => {
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
            });
            // SECURITY: agent tokens (token_use: 'agent') are never valid as a user
            // session — they authenticate only via createAgentAuthMiddleware on the
            // routes scoped to them. Each token type opens exactly one kind of door.
            if (user.token_use === 'agent') {
                return c.json({ error: 'Forbidden' }, 403);
            }
            // SECURITY: owner admission — a valid suite JWT is not enough for a
            // single-user service; the token must belong to the configured owner.
            if (ownerUserId && user.id !== ownerUserId) {
                return c.json({ error: 'Forbidden' }, 403);
            }
            c.set('user', user);
            await next();
        }
        catch {
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
    const optionalAuth = async (c, next) => {
        const token = getCookie(c, 'auth_token');
        if (token) {
            try {
                // SECURITY: Same algorithm restriction as requireAuth
                const user = jwt.verify(token, jwtSecret, {
                    algorithms: ['HS256'],
                });
                // Same rules as requireAuth: agent tokens and non-owner tokens are
                // treated as anonymous rather than authenticated.
                if (user.token_use !== 'agent' && (!ownerUserId || user.id === ownerUserId)) {
                    c.set('user', user);
                }
            }
            catch {
                // Invalid token, continue without user (don't block)
            }
        }
        await next();
    };
    /**
     * Get the current user from context
     */
    const getUser = (c) => {
        return c.get('user') || null;
    };
    return { requireAuth, optionalAuth, getUser };
}
//# sourceMappingURL=auth.js.map