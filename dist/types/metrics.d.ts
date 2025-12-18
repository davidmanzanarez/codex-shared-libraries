/**
 * Individual request metric
 */
export interface RequestMetric {
    timestamp: string;
    service: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
    ip: string;
    userAgent: string;
    userId?: string;
    isBot: boolean;
    isInternal: boolean;
    isSuspicious: boolean;
    suspiciousReason?: string;
}
/**
 * Aggregated statistics across requests
 */
export interface AggregatedStats {
    totalRequests: number;
    externalRequests: number;
    internalRequests: number;
    requestsByStatus: Record<number, number>;
    requestsByPath: Record<string, number>;
    requestsByIP: Record<string, number>;
    botRequests: number;
    suspiciousRequests: number;
    avgDurationMs: number;
    lastUpdated: string;
}
//# sourceMappingURL=metrics.d.ts.map