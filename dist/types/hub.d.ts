/**
 * Health check response format (required for Hub monitoring)
 */
export interface HealthCheckResponse {
    status: 'ok';
    service: string;
    timestamp: string;
}
/**
 * Hub summary response format (displayed on Hub dashboard)
 */
export interface HubSummaryResponse {
    service: string;
    lastUpdated: string;
    status: 'healthy' | 'stale' | 'error' | 'offline';
    metrics: {
        primary: {
            label: string;
            value: string | number;
        };
        secondary?: Array<{
            label: string;
            value: string | number;
        }>;
    };
    objectiveProgress?: number;
}
//# sourceMappingURL=hub.d.ts.map