/**
 * Compile-time compatibility fixture.
 *
 * Code shaped like what consumers wrote against the previous release. It is
 * type-checked against the committed dist/ declarations by
 * `npm run typecheck:compat` (and CI); it never runs. If a change here stops
 * compiling, the public API broke for an existing consumer.
 */
import type { Context } from 'hono';
import {
  createAuthMiddleware,
  createAgentAuthMiddleware,
  createAuthRoutes,
  createMetricsRoutes,
  createMetricsStore,
  createRateLimitStore,
  getAggregatedStats,
  getClientIP,
  isInternalRequest,
  metricsLogger,
  rateLimiter,
  type AuthUser,
  type HubSummaryResponse,
  type RateLimitConfig,
  type RateLimitOptions,
} from '../../dist/index.js';

declare const c: Context;

// 0.1.0 signatures, called exactly as the service wrappers call them
const store = createRateLimitStore();
const limit: RateLimitConfig = { limit: 100, window: 60 };
const options: RateLimitOptions = { default: limit, endpoints: { '/api/auth': limit } };
rateLimiter(store, options);
rateLimiter(store, { default: limit, keyGenerator: (ctx: Context) => ctx.req.path });

// A hand-built entry without the (later-added) windowMs field must still type-check
store.set('legacy', { timestamps: [] });
// A structurally compatible map is accepted as the store
rateLimiter(new Map<string, { timestamps: number[] }>(), options);

const metrics = createMetricsStore(1000);
metricsLogger('svc', { store: metrics, getUserId: () => undefined });
getAggregatedStats(metrics);

const ip: string = getClientIP(c);
const internal: boolean = isInternalRequest(ip);

const { requireAuth, optionalAuth, getUser } = createAuthMiddleware({
  jwtSecret: 's', hubPublicUrl: 'h', frontendUrl: 'f',
});
const user: AuthUser | null = getUser(c);
createAuthMiddleware({ jwtSecret: 's', hubPublicUrl: 'h', frontendUrl: 'f', ownerUserId: 'o' });
createAgentAuthMiddleware({ jwtSecret: 's', ownerUserId: 'o', audience: 'a', requiredScope: 'r' });
createAuthRoutes({ jwtSecret: 's', hubPublicUrl: 'h', selfUrl: 'u', frontendUrl: 'f', cookieDomain: '.d' });
createMetricsRoutes({ store: metrics, requireAuth, getUser, ownerUserId: 'o' });

// Summary shape as services returned it before `trend` existed
const summary: HubSummaryResponse = {
  service: 'svc',
  lastUpdated: 'now',
  status: 'healthy',
  metrics: { primary: { label: 'Items', value: 0 } },
};

void [optionalAuth, user, internal, summary];
