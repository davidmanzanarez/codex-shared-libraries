/**
 * Service Auth Middleware Factory
 *
 * Authenticates SERVICE-TO-SERVICE calls: a sibling service (typically the
 * Hub aggregating summaries, or one service enriching its view with
 * another's data) presenting a shared secret over the private network.
 * Services are the third principal class next to browser users (cookie
 * JWT, createAuthMiddleware) and agents (bearer JWT,
 * createAgentAuthMiddleware).
 *
 * SECURITY MODEL:
 * - The secret is read from a header (default X-Hub-Secret), compared in
 *   constant time, never logged.
 * - The caller says which user the call is scoped to via X-User-Id; the
 *   callee must scope every query to it. Requiring it is the default so an
 *   internal endpoint cannot accidentally serve cross-user data.
 * - No cookie or bearer token is consulted: a user session or an agent
 *   token presented here is simply not a service credential.
 */
import type { Context, MiddlewareHandler } from 'hono';
export interface ServiceAuthMiddlewareConfig {
    /** Shared secret every service in the network is configured with. */
    secret: string;
    /** Header carrying the secret. Default: 'X-Hub-Secret'. */
    secretHeader?: string;
    /** Header naming the user the call is scoped to. Default: 'X-User-Id'. */
    userIdHeader?: string;
    /**
     * Reject calls that do not name a user (400). Default: true.
     * Set false only for endpoints that are genuinely user-agnostic.
     */
    requireUserId?: boolean;
}
export interface ServiceAuthMiddleware {
    /** Middleware that requires the shared secret (401) and, by default, a user id (400). */
    requireServiceAuth: MiddlewareHandler;
    /** The user id the current service call is scoped to, once requireServiceAuth passed. */
    getServiceUserId: (c: Context) => string | null;
}
/**
 * Creates service-to-service auth middleware.
 *
 * @example
 * ```typescript
 * const { requireServiceAuth, getServiceUserId } = createServiceAuthMiddleware({
 *   secret: env.hubSecret,
 * });
 * app.use('/api/internal/*', requireServiceAuth);
 * app.use('/api/hub/*', requireServiceAuth);
 * ```
 */
export declare function createServiceAuthMiddleware(config: ServiceAuthMiddlewareConfig): ServiceAuthMiddleware;
//# sourceMappingURL=serviceAuth.d.ts.map