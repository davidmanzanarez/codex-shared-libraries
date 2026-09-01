import jwt from 'jsonwebtoken';
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
export function createAgentAuthMiddleware(config) {
    const { jwtSecret, ownerUserId, audience, requiredScope } = config;
    if (!jwtSecret)
        throw new Error('AgentAuthMiddleware: jwtSecret is required');
    if (!ownerUserId)
        throw new Error('AgentAuthMiddleware: ownerUserId is required — agent endpoints must not run without owner admission');
    if (!audience)
        throw new Error('AgentAuthMiddleware: audience is required');
    if (!requiredScope)
        throw new Error('AgentAuthMiddleware: requiredScope is required');
    const requireAgentAuth = async (c, next) => {
        const header = c.req.header('Authorization') || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        let claims;
        try {
            // SECURITY: algorithm hardcoded; audience verified by the library so a
            // token minted for another service fails before any custom checks run.
            claims = jwt.verify(token, jwtSecret, {
                algorithms: ['HS256'],
                audience,
            });
        }
        catch {
            return c.json({ error: 'Invalid token' }, 401);
        }
        if (claims.token_use !== 'agent') {
            // A user-session JWT presented as a bearer token. Wrong door.
            return c.json({ error: 'Forbidden' }, 403);
        }
        if (claims.id !== ownerUserId) {
            return c.json({ error: 'Forbidden' }, 403);
        }
        const scopes = (claims.scope || '').split(' ').filter(Boolean);
        if (!scopes.includes(requiredScope)) {
            return c.json({ error: 'Forbidden' }, 403);
        }
        c.set('agentClaims', claims);
        await next();
    };
    const getAgentClaims = (c) => {
        return c.get('agentClaims') || null;
    };
    return { requireAgentAuth, getAgentClaims };
}
//# sourceMappingURL=agentAuth.js.map