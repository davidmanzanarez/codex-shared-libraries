/**
 * Auth Routes Factory
 * Creates standard auth endpoints that proxy to Hub
 */
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
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
export function createAuthRoutes(config) {
    const { jwtSecret, hubPublicUrl, selfUrl, frontendUrl, isProduction = process.env.NODE_ENV === 'production', cookieMaxAge = 60 * 60 * 24 * 7, // 7 days
    cookieDomain, } = config;
    // Validate config at creation time (fail fast)
    if (!jwtSecret) {
        throw new Error('AuthRoutes: jwtSecret is required');
    }
    if (!hubPublicUrl) {
        throw new Error('AuthRoutes: hubPublicUrl is required');
    }
    if (!selfUrl) {
        throw new Error('AuthRoutes: selfUrl is required');
    }
    if (!frontendUrl) {
        throw new Error('AuthRoutes: frontendUrl is required');
    }
    const app = new Hono();
    // Callback URL for Hub to redirect back to
    const callbackUrl = `${selfUrl}/api/auth/callback`;
    // Hub's Google OAuth endpoint
    const hubAuthUrl = `${hubPublicUrl}/api/auth/google`;
    /**
     * GET /me - Check if user is authenticated
     * Returns user info if authenticated, or loginUrl if not
     */
    app.get('/me', (c) => {
        const token = getCookie(c, 'auth_token');
        const loginUrl = `${hubAuthUrl}?returnTo=${encodeURIComponent(callbackUrl)}`;
        if (!token) {
            return c.json({
                authenticated: false,
                user: null,
                loginUrl,
            });
        }
        try {
            // SECURITY: Algorithm hardcoded to prevent confusion attacks
            const user = jwt.verify(token, jwtSecret, {
                algorithms: ['HS256'],
            });
            return c.json({ authenticated: true, user });
        }
        catch {
            // Invalid or expired token - clear it
            deleteCookie(c, 'auth_token', { path: '/', domain: cookieDomain });
            return c.json({
                authenticated: false,
                user: null,
                loginUrl,
            });
        }
    });
    /**
     * GET /login - Redirect to Hub login
     * Accepts optional returnTo query param for post-login redirect
     */
    app.get('/login', (c) => {
        const returnTo = c.req.query('returnTo') || callbackUrl;
        return c.redirect(`${hubAuthUrl}?returnTo=${encodeURIComponent(returnTo)}`);
    });
    /**
     * GET /callback - Complete auth after Hub redirect
     * Supports both cookie-based auth (shared domain) and token query param (legacy)
     */
    app.get('/callback', (c) => {
        const tokenParam = c.req.query('token');
        const existingCookie = getCookie(c, 'auth_token');
        // Prefer cookie if already set (e.g. via shared domain from Hub)
        const token = tokenParam || existingCookie;
        if (!token) {
            return c.redirect(`${frontendUrl}?error=no_token`);
        }
        try {
            jwt.verify(token, jwtSecret, {
                algorithms: ['HS256'],
            });
            // Set/refresh local cookie
            setCookie(c, 'auth_token', token, {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'Lax',
                maxAge: cookieMaxAge,
                path: '/',
                domain: cookieDomain,
            });
            return c.redirect(frontendUrl);
        }
        catch {
            return c.redirect(`${frontendUrl}?error=invalid_token`);
        }
    });
    /**
     * POST /logout - Clear auth cookie
     */
    app.post('/logout', (c) => {
        deleteCookie(c, 'auth_token', { path: '/', domain: cookieDomain });
        return c.json({ success: true });
    });
    return app;
}
//# sourceMappingURL=auth.js.map