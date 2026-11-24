/**
 * Auth Routes Factory
 * Creates standard auth endpoints that proxy to Hub
 */
import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import jwt from 'jsonwebtoken';
import type { AuthUser } from '../types/auth.js';

export const DEFAULT_REFRESH_COOKIE_NAME = 'ddk_refresh';
export const DEFAULT_REFRESH_MAX_AGE = 60 * 60 * 24 * 365; // 365 days

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

interface HubRefreshResponse {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  refreshExpiresIn?: number;
  user?: AuthUser;
}

type RefreshOutcome =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: 'unavailable' | 'ended' | 'error' };

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
export function createAuthRoutes(config: AuthRoutesConfig) {
  const {
    jwtSecret,
    hubPublicUrl,
    selfUrl,
    frontendUrl,
    isProduction = process.env.NODE_ENV === 'production',
    cookieMaxAge = 60 * 60 * 24 * 7, // 7 days
    cookieDomain,
    hubInternalUrl,
    hubSecret,
    refreshCookieName = DEFAULT_REFRESH_COOKIE_NAME,
    refreshCookieMaxAge = DEFAULT_REFRESH_MAX_AGE,
    refreshTimeoutMs = 5000,
    fetchFn = globalThis.fetch,
  } = config;

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

  const hubBase = hubInternalUrl ? hubInternalUrl.replace(/\/$/, '') : undefined;
  const refreshEnabled = Boolean(hubBase && hubSecret);

  const app = new Hono();

  // Callback URL for Hub to redirect back to
  const callbackUrl = `${selfUrl}/api/auth/callback`;

  // Hub's Google OAuth endpoint
  const hubAuthUrl = `${hubPublicUrl}/api/auth/google`;

  function clearAuthCookies(c: Context, includeRefresh: boolean) {
    deleteCookie(c, 'auth_token', { path: '/', domain: cookieDomain });
    if (includeRefresh) {
      deleteCookie(c, refreshCookieName, { path: '/api/auth', domain: cookieDomain });
    }
  }

  async function refreshViaHub(c: Context): Promise<RefreshOutcome> {
    if (!refreshEnabled || !hubBase || !hubSecret) {
      return { ok: false, reason: 'unavailable' };
    }
    const refreshToken = getCookie(c, refreshCookieName);
    if (!refreshToken) {
      return { ok: false, reason: 'unavailable' };
    }

    try {
      const forwardedFor = c.req.header('x-forwarded-for');
      const ip = forwardedFor ? forwardedFor.split(',')[0]?.trim() : undefined;
      const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(refreshTimeoutMs)
        : undefined;

      const res = await fetchFn(`${hubBase}/api/internal/sessions/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Secret': hubSecret,
        },
        body: JSON.stringify({
          refreshToken,
          userAgent: c.req.header('user-agent') || undefined,
          ip: ip || undefined,
        }),
        signal,
      });

      if (res.status === 401 || res.status === 403) {
        clearAuthCookies(c, true);
        return { ok: false, reason: 'ended' };
      }
      if (!res.ok) {
        return { ok: false, reason: 'error' };
      }

      const data = (await res.json()) as HubRefreshResponse;
      if (typeof data.accessToken !== 'string' || !data.accessToken) {
        return { ok: false, reason: 'error' };
      }

      // Verify the minted access JWT with our shared secret before trusting it
      let verifiedUser: AuthUser;
      try {
        verifiedUser = jwt.verify(data.accessToken, jwtSecret, {
          algorithms: ['HS256'],
        }) as AuthUser;
      } catch {
        return { ok: false, reason: 'error' };
      }

      const accessMaxAge = typeof data.expiresIn === 'number' && data.expiresIn > 0
        ? data.expiresIn
        : 60 * 60 * 24;
      setCookie(c, 'auth_token', data.accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'Lax',
        maxAge: accessMaxAge,
        path: '/',
        domain: cookieDomain,
      });

      if (typeof data.refreshToken === 'string' && data.refreshToken) {
        const nextRefreshMaxAge = typeof data.refreshExpiresIn === 'number' && data.refreshExpiresIn > 0
          ? data.refreshExpiresIn
          : refreshCookieMaxAge;
        setCookie(c, refreshCookieName, data.refreshToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'Lax',
          maxAge: nextRefreshMaxAge,
          path: '/api/auth',
          domain: cookieDomain,
        });
      }

      return { ok: true, user: data.user ?? verifiedUser };
    } catch {
      return { ok: false, reason: 'error' };
    }
  }

  /**
   * GET /me - Check if user is authenticated
   * Returns user info if authenticated, or loginUrl if not.
   * When auth_token is missing or expired and Hub refresh is configured,
   * transparently exchanges the refresh cookie for fresh cookies.
   */
  app.get('/me', async (c) => {
    const token = getCookie(c, 'auth_token');
    const loginUrl = `${hubAuthUrl}?returnTo=${encodeURIComponent(callbackUrl)}`;

    let hadInvalidAccessToken = false;
    if (token) {
      try {
        // SECURITY: Algorithm hardcoded to prevent confusion attacks
        const user = jwt.verify(token, jwtSecret, {
          algorithms: ['HS256'],
        }) as AuthUser;

        return c.json({ authenticated: true, user });
      } catch {
        hadInvalidAccessToken = true;
      }
    }

    if (refreshEnabled && getCookie(c, refreshCookieName)) {
      const outcome = await refreshViaHub(c);
      if (outcome.ok) {
        return c.json({ authenticated: true, user: outcome.user });
      }
      if (hadInvalidAccessToken && outcome.reason !== 'ended') {
        clearAuthCookies(c, false);
      }
    } else if (hadInvalidAccessToken) {
      // Invalid or expired token - clear it
      clearAuthCookies(c, false);
    }

    return c.json({
      authenticated: false,
      user: null,
      loginUrl,
    });
  });

  /**
   * POST /refresh - Explicitly exchange the refresh cookie via Hub for a fresh access cookie.
   * Used by web clients' single-flight 401 interceptors.
   */
  app.post('/refresh', async (c) => {
    if (!refreshEnabled) {
      return c.json({ error: 'Session refresh not configured' }, 501);
    }
    if (!getCookie(c, refreshCookieName)) {
      return c.json({ error: 'No refresh token' }, 401);
    }

    const outcome = await refreshViaHub(c);
    if (outcome.ok) {
      return c.json({ ok: true, authenticated: true, user: outcome.user });
    }
    if (outcome.reason === 'ended') {
      return c.json({ error: 'Session expired' }, 401);
    }
    return c.json({ error: 'Auth service unavailable' }, 503);
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
   * GET /callback - Complete auth after Hub redirect (cookie-based ONLY).
   *
   * SECURITY: This endpoint previously also accepted ?token=<JWT>. That put
   * JWTs into edge/application logs (query strings are logged) and enabled
   * login-CSRF (an attacker could sit a victim on the attacker's session).
   * The Hub has set the shared-domain cookie directly since Mar 2026, so
   * any token query param arriving here is now ignored — only the
   * shared-domain cookie is trusted, and it is refreshed as a local cookie.
   */
  app.get('/callback', (c) => {
    const token = getCookie(c, 'auth_token');

    if (!token) {
      return c.redirect(`${frontendUrl}?error=no_token`);
    }

    try {
      jwt.verify(token, jwtSecret, {
        algorithms: ['HS256'],
      });

      // Refresh local cookie
      setCookie(c, 'auth_token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'Lax',
        maxAge: cookieMaxAge,
        path: '/',
        domain: cookieDomain,
      });

      return c.redirect(frontendUrl);
    } catch {
      return c.redirect(`${frontendUrl}?error=invalid_token`);
    }
  });

  /**
   * POST /logout - Clear auth cookies and best-effort revoke the refresh session on Hub
   */
  app.post('/logout', async (c) => {
    const refreshToken = getCookie(c, refreshCookieName);
    clearAuthCookies(c, Boolean(refreshToken || refreshEnabled));

    if (refreshEnabled && hubBase && hubSecret && refreshToken) {
      try {
        const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(refreshTimeoutMs)
          : undefined;
        await fetchFn(`${hubBase}/api/internal/sessions/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hub-Secret': hubSecret,
          },
          body: JSON.stringify({ refreshToken }),
          signal,
        });
      } catch {
        // Best-effort revocation; cookies are already cleared locally
      }
    }

    return c.json({ success: true });
  });

  return app;
}
