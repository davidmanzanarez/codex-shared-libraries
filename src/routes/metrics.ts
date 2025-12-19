/**
 * Metrics Routes Factory
 * Creates standard metrics endpoints for any service
 */
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import type { MetricsStore } from '../middleware/metrics.js';
import {
  getRecentMetrics,
  getAggregatedStats,
  getSuspiciousRequests,
  getRequestsByIP,
} from '../middleware/metrics.js';

export interface MetricsRoutesOptions {
  /** Metrics store instance */
  store: MetricsStore;
  /** Middleware to require authentication */
  requireAuth: (c: Context, next: Next) => Promise<Response | void>;
  /** Function to get user from context */
  getUser: (c: Context) => { id: string } | null | undefined;
  /** Owner user ID (only owner can access metrics) */
  ownerUserId?: string;
}

/**
 * Create metrics routes for a service
 *
 * @example
 * import { createMetricsRoutes } from '@dodekatloi/shared';
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
export function createMetricsRoutes(options: MetricsRoutesOptions) {
  const { store, requireAuth, getUser, ownerUserId } = options;

  const app = new Hono();

  // All metrics endpoints require authentication
  app.use('/*', requireAuth);

  // Check if user is owner (only owner can see metrics)
  const requireOwner = async (c: Context, next: Next) => {
    const user = getUser(c);
    if (!ownerUserId || user?.id !== ownerUserId) {
      return c.json({ error: 'Forbidden - owner access required' }, 403);
    }
    await next();
  };

  app.use('/*', requireOwner);

  // Get aggregated stats summary
  app.get('/summary', (c) => {
    const stats = getAggregatedStats(store);
    return c.json({
      ...stats,
      topPaths: Object.entries(stats.requestsByPath)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10),
      topIPs: Object.entries(stats.requestsByIP)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10),
    });
  });

  // Get recent requests (last 100)
  app.get('/recent', (c) => {
    const limit = parseInt(c.req.query('limit') || '100', 10);
    return c.json(getRecentMetrics(store, Math.min(limit, 500)));
  });

  // Get suspicious requests
  app.get('/suspicious', (c) => {
    const limit = parseInt(c.req.query('limit') || '50', 10);
    return c.json(getSuspiciousRequests(store, Math.min(limit, 200)));
  });

  // Get requests by IP
  app.get('/ip/:ip', (c) => {
    const ip = c.req.param('ip');
    const limit = parseInt(c.req.query('limit') || '50', 10);
    return c.json(getRequestsByIP(store, ip, Math.min(limit, 200)));
  });

  // Get status code breakdown
  app.get('/status', (c) => {
    const stats = getAggregatedStats(store);
    const breakdown = {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0,
      details: stats.requestsByStatus,
    };

    for (const [status, count] of Object.entries(stats.requestsByStatus)) {
      const code = parseInt(status, 10);
      if (code >= 200 && code < 300) breakdown['2xx'] += count;
      else if (code >= 300 && code < 400) breakdown['3xx'] += count;
      else if (code >= 400 && code < 500) breakdown['4xx'] += count;
      else if (code >= 500) breakdown['5xx'] += count;
    }

    return c.json(breakdown);
  });

  return app;
}
