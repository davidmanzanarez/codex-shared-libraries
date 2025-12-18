/**
 * Request Metrics Middleware
 * Logs all requests with detailed info for security analysis
 */
import type { Context, Next } from 'hono';
import type { RequestMetric, AggregatedStats } from '../types/metrics.js';
/**
 * Metrics store - holds recent requests in memory
 */
export interface MetricsStore {
    metrics: RequestMetric[];
    stats: AggregatedStats;
    maxMetrics: number;
}
/**
 * Create a new metrics store
 */
export declare function createMetricsStore(maxMetrics?: number): MetricsStore;
export interface MetricsLoggerOptions {
    store: MetricsStore;
    /**
     * Function to get user ID from context (optional)
     * If not provided, userId will be undefined
     */
    getUserId?: (c: Context) => string | undefined;
}
/**
 * Create metrics logger middleware
 */
export declare function metricsLogger(serviceName: string, options: MetricsLoggerOptions): (c: Context, next: Next) => Promise<void>;
/**
 * Get recent metrics from store
 */
export declare function getRecentMetrics(store: MetricsStore, limit?: number): RequestMetric[];
/**
 * Get aggregated stats from store
 */
export declare function getAggregatedStats(store: MetricsStore): AggregatedStats;
/**
 * Get suspicious requests from store
 */
export declare function getSuspiciousRequests(store: MetricsStore, limit?: number): RequestMetric[];
/**
 * Get requests by IP from store
 */
export declare function getRequestsByIP(store: MetricsStore, ip: string, limit?: number): RequestMetric[];
/**
 * Reset metrics store
 */
export declare function resetMetrics(store: MetricsStore): void;
//# sourceMappingURL=metrics.d.ts.map