/**
 * Metrics Routes Factory
 * Creates standard metrics endpoints for any service
 */
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import type { MetricsStore } from '../middleware/metrics.js';
export interface MetricsRoutesOptions {
    /** Metrics store instance */
    store: MetricsStore;
    /** Middleware to require authentication */
    requireAuth: (c: Context, next: Next) => Promise<Response | void>;
    /** Function to get user from context */
    getUser: (c: Context) => {
        id: string;
    } | null | undefined;
    /** Owner user ID (only owner can access metrics) */
    ownerUserId?: string;
}
/**
 * Create metrics routes for a service
 *
 * @example
 * import { createMetricsRoutes } from '@codex/shared';
 *
 * const metricsRoutes = createMetricsRoutes({
 *   store: metricsStore,
 *   requireAuth,
 *   getUser,
 *   ownerUserId: process.env.OWNER_USER_ID,
 * });
 *
 * app.route('/api/metrics', metricsRoutes);
 */
export declare function createMetricsRoutes(options: MetricsRoutesOptions): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=metrics.d.ts.map