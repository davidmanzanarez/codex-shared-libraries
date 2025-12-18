import { getClientIP, isInternalRequest } from '../utils/ip.js';
// Bot detection patterns (external bots/crawlers)
const BOT_PATTERNS = [
    /bot|crawler|spider|scraper/i,
    /googlebot|bingbot|slurp|duckduckbot|baiduspider/i,
    /facebookexternalhit|twitterbot|linkedinbot/i,
    /semrush|ahrefs|moz|dotbot/i,
];
// Suspicious path patterns (common attack vectors)
const SUSPICIOUS_PATTERNS = [
    /\.(php|asp|aspx|jsp|cgi|pl)$/i,
    /wp-admin|wp-login|wp-content|wordpress/i,
    /phpmyadmin|adminer|pma/i,
    /\.env|\.git|\.htaccess|\.aws/i,
    /config\.json|package\.json|composer\.json/i,
    /\/\.\.|%2e%2e|%252e/i, // Path traversal
    /<script|javascript:|data:/i, // XSS attempts
    /union.*select|insert.*into|drop.*table/i, // SQL injection
    /nikto|sqlmap|nmap|masscan/i, // Scanning tools
    /gobuster|dirbuster|dirb|ffuf/i, // Directory bruteforce
];
/**
 * Create a new metrics store
 */
export function createMetricsStore(maxMetrics = 1000) {
    return {
        metrics: [],
        stats: {
            totalRequests: 0,
            externalRequests: 0,
            internalRequests: 0,
            requestsByStatus: {},
            requestsByPath: {},
            requestsByIP: {},
            botRequests: 0,
            suspiciousRequests: 0,
            avgDurationMs: 0,
            lastUpdated: new Date().toISOString(),
        },
        maxMetrics,
    };
}
function isBot(userAgent, ip) {
    if (isInternalRequest(ip))
        return false;
    if (!userAgent)
        return true;
    return BOT_PATTERNS.some(pattern => pattern.test(userAgent));
}
function checkSuspicious(path, userAgent) {
    for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(path)) {
            return { suspicious: true, reason: `path_match:${pattern.source.slice(0, 20)}` };
        }
        if (pattern.test(userAgent)) {
            return { suspicious: true, reason: `ua_match:${pattern.source.slice(0, 20)}` };
        }
    }
    return { suspicious: false };
}
function updateAggregatedStats(store, metric) {
    const stats = store.stats;
    stats.totalRequests++;
    if (metric.isInternal) {
        stats.internalRequests++;
    }
    else {
        stats.externalRequests++;
    }
    stats.requestsByStatus[metric.status] =
        (stats.requestsByStatus[metric.status] || 0) + 1;
    if (!metric.isInternal) {
        const pathKey = metric.path.split('/').slice(0, 4).join('/');
        stats.requestsByPath[pathKey] =
            (stats.requestsByPath[pathKey] || 0) + 1;
    }
    if (!metric.isInternal) {
        if (Object.keys(stats.requestsByIP).length < 100 || stats.requestsByIP[metric.ip]) {
            stats.requestsByIP[metric.ip] =
                (stats.requestsByIP[metric.ip] || 0) + 1;
        }
    }
    if (metric.isBot)
        stats.botRequests++;
    if (metric.isSuspicious)
        stats.suspiciousRequests++;
    if (!metric.isInternal) {
        const externalCount = stats.externalRequests;
        stats.avgDurationMs =
            (stats.avgDurationMs * (externalCount - 1) + metric.durationMs) / externalCount;
    }
    stats.lastUpdated = new Date().toISOString();
}
/**
 * Create metrics logger middleware
 */
export function metricsLogger(serviceName, options) {
    const { store, getUserId } = options;
    return async (c, next) => {
        const start = Date.now();
        const path = c.req.path;
        const method = c.req.method;
        const userAgent = c.req.header('user-agent') || '';
        const ip = getClientIP(c);
        await next();
        const duration = Date.now() - start;
        const status = c.res.status;
        const userId = getUserId?.(c);
        const internalCheck = isInternalRequest(ip);
        const botCheck = isBot(userAgent, ip);
        const suspiciousCheck = checkSuspicious(path, userAgent);
        const metric = {
            timestamp: new Date().toISOString(),
            service: serviceName,
            method,
            path,
            status,
            durationMs: duration,
            ip,
            userAgent: userAgent.slice(0, 200),
            userId,
            isBot: botCheck,
            isInternal: internalCheck,
            isSuspicious: suspiciousCheck.suspicious,
            suspiciousReason: suspiciousCheck.reason,
        };
        store.metrics.push(metric);
        if (store.metrics.length > store.maxMetrics) {
            store.metrics.shift();
        }
        updateAggregatedStats(store, metric);
        if (suspiciousCheck.suspicious) {
            console.warn(`[SUSPICIOUS] ${ip} ${method} ${path} - ${suspiciousCheck.reason}`);
        }
    };
}
/**
 * Get recent metrics from store
 */
export function getRecentMetrics(store, limit = 100) {
    return store.metrics.slice(-limit);
}
/**
 * Get aggregated stats from store
 */
export function getAggregatedStats(store) {
    return { ...store.stats };
}
/**
 * Get suspicious requests from store
 */
export function getSuspiciousRequests(store, limit = 50) {
    return store.metrics.filter(m => m.isSuspicious).slice(-limit);
}
/**
 * Get requests by IP from store
 */
export function getRequestsByIP(store, ip, limit = 50) {
    return store.metrics.filter(m => m.ip === ip).slice(-limit);
}
/**
 * Reset metrics store
 */
export function resetMetrics(store) {
    store.metrics.length = 0;
    store.stats = {
        totalRequests: 0,
        externalRequests: 0,
        internalRequests: 0,
        requestsByStatus: {},
        requestsByPath: {},
        requestsByIP: {},
        botRequests: 0,
        suspiciousRequests: 0,
        avgDurationMs: 0,
        lastUpdated: new Date().toISOString(),
    };
}
//# sourceMappingURL=metrics.js.map