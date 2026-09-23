import { safeEqual } from '../utils/secrets.js';
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
export function createServiceAuthMiddleware(config) {
    const { secret, secretHeader = 'X-Hub-Secret', userIdHeader = 'X-User-Id', requireUserId = true, contextKey = 'serviceUserId', } = config;
    if (!secret) {
        throw new Error('ServiceAuthMiddleware: secret is required');
    }
    const requireServiceAuth = async (c, next) => {
        if (!safeEqual(c.req.header(secretHeader), secret)) {
            // SECURITY: same generic answer for missing and wrong secrets
            return c.json({ error: 'Unauthorized' }, 401);
        }
        const userId = c.req.header(userIdHeader);
        if (requireUserId && !userId) {
            return c.json({ error: `${userIdHeader} header required` }, 400);
        }
        c.set(contextKey, userId ?? null);
        await next();
    };
    const getServiceUserId = (c) => {
        return c.get(contextKey) ?? null;
    };
    return { requireServiceAuth, getServiceUserId };
}
//# sourceMappingURL=serviceAuth.js.map