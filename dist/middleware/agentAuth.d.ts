/**
 * Agent Auth Middleware Factory
 *
 * Authenticates AGENT access tokens — short-lived JWTs minted by the Hub in
 * exchange for a revocable agent grant. Agents are a third principal class
 * (not a browser user, not a sibling service): an automated actor operating
 * on behalf of the owner with a narrow, explicit scope.
 *
 * SECURITY MODEL:
 * - Token is read ONLY from the Authorization: Bearer header (never cookies),
 *   the mirror image of the user middleware, which reads ONLY the cookie.
 * - Algorithm is hardcoded to HS256 (prevents algorithm confusion attacks).
 * - The token must carry token_use: 'agent'. User-session JWTs are rejected
 *   here, and agent JWTs are rejected by createAuthMiddleware — each token
 *   type opens exactly one kind of door.
 * - `aud` must equal this service's configured audience, so a token minted
 *   for one service cannot be replayed against another.
 * - `scope` (space-delimited, OAuth style) must contain the required scope.
 * - The token's user id must equal ownerUserId (owner admission, same
 *   defense-in-depth rule as the user middleware).
 */
import type { Context, MiddlewareHandler } from 'hono';
import type { AuthUser } from '../types/auth.js';
/**
 * Claims carried by an agent access token, beyond the standard user fields.
 */
export interface AgentTokenClaims extends AuthUser {
    /** Discriminates agent tokens from user-session tokens. Always 'agent'. */
    token_use: 'agent';
    /** Space-delimited scopes, e.g. 'memoriam:notes:write'. */
    scope: string;
    /** Audience: the service this token was minted for, e.g. 'memoriam'. */
    aud: string;
    /** RFC 8693 actor claim: who is acting on the owner's behalf. */
    act?: {
        sub: string;
    };
    /** Token id, recorded for audit trails. */
    jti?: string;
    /** Id of the agent grant this token was exchanged from (audit trail). */
    grant_id?: string;
}
export interface AgentAuthMiddlewareConfig {
    /** JWT secret — MUST match the secret the Hub signs with. */
    jwtSecret: string;
    /**
     * The only user id admitted. Required: agent tokens always act on behalf
     * of the owner, and a token for anyone else is rejected outright.
     */
    ownerUserId: string;
    /** This service's audience string (e.g. 'memoriam'). */
    audience: string;
    /** Scope the route requires (e.g. 'memoriam:notes:write'). */
    requiredScope: string;
}
export interface AgentAuthMiddleware {
    /** Middleware that requires a valid agent token. 401/403 JSON on failure. */
    requireAgentAuth: MiddlewareHandler;
    /** Get the verified agent claims from context (set by requireAgentAuth). */
    getAgentClaims: (c: Context) => AgentTokenClaims | null;
}
/**
 * Creates agent-token auth middleware for a service endpoint.
 *
 * @example
 * ```typescript
 * const { requireAgentAuth, getAgentClaims } = createAgentAuthMiddleware({
 *   jwtSecret: env.jwtSecret,
 *   ownerUserId: env.ownerUserId,
 *   audience: 'memoriam',
 *   requiredScope: 'memoriam:notes:write',
 * });
 * app.use('/api/agent/*', requireAgentAuth);
 * ```
 */
export declare function createAgentAuthMiddleware(config: AgentAuthMiddlewareConfig): AgentAuthMiddleware;
//# sourceMappingURL=agentAuth.d.ts.map