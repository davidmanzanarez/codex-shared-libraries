/**
 * Request Metrics Middleware
 * Logs all requests with detailed info for security analysis
 */
import type { Context, Next } from 'hono';
import type { RequestMetric, AggregatedStats } from '../types/metrics.js';
import { getClientIP, isInternalRequest } from '../utils/ip.js';

// Bot detection patterns (external bots/crawlers)
const BOT_PATTERNS = [
  /bot|crawler|spider|scraper/i,
  /googlebot|bingbot|slurp|duckduckbot|baiduspider/i,
  /facebookexternalhit|twitterbot|linkedinbot/i,
  /semrush|ahrefs|rogerbot|dotbot/i,
  // Programmatic clients: not humans, whatever network they came from
  /^(node|undici|curl|wget|python-requests|go-http-client|okhttp)\b/i,
];

// Suspicious path patterns (common attack vectors)
const SUSPICIOUS_PATTERNS = [
  /\.(php|asp|aspx|jsp|cgi|pl)$/i,
  /wp-admin|wp-login|wp-content|wordpress/i,
  /phpmyadmin|adminer|pma/i,
  /\.env|\.git|\.htaccess|\.aws/i,
  /config\.json|package\.json|composer\.json/i,
  /\/\.\.|%2e%2e|%252e/i,  // Path traversal
  /<script|javascript:|data:/i,  // XSS attempts
  /union.*select|insert.*into|drop.*table/i,  // SQL injection
  /nikto|sqlmap|nmap|masscan/i,  // Scanning tools
  /gobuster|dirbuster|dirb|ffuf/i,  // Directory bruteforce
];

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
export function createMetricsStore(maxMetrics = 1000): MetricsStore {
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

function isBot(userAgent: string, ip: string): boolean {
  if (isInternalRequest(ip)) return false;
  if (!userAgent) return true;
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent));
}

function checkSuspicious(path: string, userAgent: string): { suspicious: boolean; reason?: string } {
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

function updateAggregatedStats(store: MetricsStore, metric: RequestMetric) {
  const stats = store.stats;
  stats.totalRequests++;

  if (metric.isInternal) {
    stats.internalRequests++;
  } else {
    stats.externalRequests++;
  }

  stats.requestsByStatus[metric.status] =
    (stats.requestsByStatus[metric.status] || 0) + 1;

  if (!metric.isInternal) {
    const pathKey = metric.path.split('/').slice(0, 4).join('/');
    stats.requestsByPath[pathKey] =
      (stats.requestsByPath[pathKey] || 0) + 1;
  }

  // An unresolved IP ('') is not an address; never let it become a key.
  if (!metric.isInternal && metric.ip) {
    if (Object.keys(stats.requestsByIP).length < 100 || stats.requestsByIP[metric.ip]) {
      stats.requestsByIP[metric.ip] =
        (stats.requestsByIP[metric.ip] || 0) + 1;
    }
  }

  if (metric.isBot) stats.botRequests++;
  if (metric.isSuspicious) stats.suspiciousRequests++;

  if (!metric.isInternal) {
    const externalCount = stats.externalRequests;
    stats.avgDurationMs =
      (stats.avgDurationMs * (externalCount - 1) + metric.durationMs) / externalCount;
  }

  stats.lastUpdated = new Date().toISOString();
}

export interface MetricsLoggerOptions {
  store: MetricsStore;
  /**
   * Function to get user ID from context (optional)
   * If not provided, userId will be undefined
   */
  getUserId?: (c: Context) => string | undefined;
  /**
   * Custom client-IP resolver (default: getClientIP from proxy headers).
   * Pass e.g. `(c) => getClientIP(c, { socketAddress: nodeSocketAddress })`
   * so proxy-less internal calls are classified as internal.
   */
  resolveIP?: (c: Context) => string;
  /**
   * Requests to leave out of the store entirely. Typical use: health checks
   * and the metrics endpoints themselves, which would otherwise inflate the
   * very numbers they report.
   */
  skip?: (c: Context) => boolean;
}

/**
 * Create metrics logger middleware
 */
export function metricsLogger(serviceName: string, options: MetricsLoggerOptions) {
  const { store, getUserId, resolveIP = getClientIP, skip } = options;

  return async (c: Context, next: Next) => {
    if (skip?.(c)) {
      return next();
    }

    const start = Date.now();
    const path = c.req.path;
    const method = c.req.method;
    const userAgent = c.req.header('user-agent') || '';
    const ip = resolveIP(c);

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;
    const userId = getUserId?.(c);

    const internalCheck = isInternalRequest(ip);
    const botCheck = isBot(userAgent, ip);
    const suspiciousCheck = checkSuspicious(path, userAgent);

    const metric: RequestMetric = {
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
export function getRecentMetrics(store: MetricsStore, limit = 100): RequestMetric[] {
  return store.metrics.slice(-limit);
}

/**
 * Get aggregated stats from store
 */
export function getAggregatedStats(store: MetricsStore): AggregatedStats {
  return { ...store.stats };
}

/**
 * Get suspicious requests from store
 */
export function getSuspiciousRequests(store: MetricsStore, limit = 50): RequestMetric[] {
  return store.metrics.filter(m => m.isSuspicious).slice(-limit);
}

/**
 * Get requests by IP from store
 */
export function getRequestsByIP(store: MetricsStore, ip: string, limit = 50): RequestMetric[] {
  return store.metrics.filter(m => m.ip === ip).slice(-limit);
}

/**
 * Reset metrics store
 */
export function resetMetrics(store: MetricsStore) {
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
