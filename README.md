# @codex/shared

Shared middleware, routes, types, and utilities for Hono-based TypeScript web services.

Provides a batteries-included auth + observability stack: JWT authentication (cookie-based with Hub proxy), rate limiting, request metrics with bot/attack detection, and common type definitions.

## Install

```json
{
  "dependencies": {
    "@codex/shared": "github:davidmanzanarez/codex-shared-libraries"
  }
}
```

Pin to a specific commit:
```json
"@codex/shared": "github:davidmanzanarez/codex-shared-libraries#abc1234"
```

## Quick Start

```typescript
import {
  createAuthMiddleware,
  createAuthRoutes,
  rateLimiter,
  metricsLogger,
} from '@codex/shared';

// Auth middleware
const { requireAuth, optionalAuth, getUser } = createAuthMiddleware({
  jwtSecret: process.env.JWT_SECRET,
  hubPublicUrl: 'https://hub.example.com',
  frontendUrl: 'https://app.example.com',
});

app.use('/api/*', requireAuth);

// Auth routes (login/callback/logout proxied to Hub)
const authRoutes = createAuthRoutes({
  jwtSecret: process.env.JWT_SECRET,
  hubPublicUrl: 'https://hub.example.com',
  selfUrl: 'https://api.example.com',
  frontendUrl: 'https://app.example.com',
});
app.route('/api/auth', authRoutes);
```

## Modules

### Middleware

#### `createAuthMiddleware(config)`

JWT authentication middleware factory. Reads tokens from `auth_token` HttpOnly cookie only (never headers or query params). Algorithm hardcoded to HS256.

Returns `{ requireAuth, optionalAuth, getUser }`:
- **requireAuth** - blocks unauthenticated requests (401 JSON for API, redirect for pages)
- **optionalAuth** - sets user in context if present, doesn't block
- **getUser(c)** - extracts `AuthUser` from request context

#### `rateLimiter(config)`

In-memory sliding window rate limiter with per-endpoint overrides.

```typescript
app.use('*', rateLimiter({
  limit: 100,
  window: 60, // seconds
  endpoints: {
    '/api/auth/*': { limit: 10, window: 60 },
    '/api/search/*': { limit: 30, window: 60 },
  },
}));
```

#### `metricsLogger(serviceName, options)`

Request metrics collection with built-in detection for bots, suspicious patterns (SQL injection, XSS, path traversal), and Docker internal traffic.

```typescript
app.use('*', metricsLogger('my-service', {
  store: metricsStore,
  getUserId: (c) => getUser(c)?.id,
}));
```

### Routes

#### `createAuthRoutes(config)`

Pre-built OAuth proxy endpoints for services that delegate auth to a central Hub:

| Endpoint | Description |
|----------|-------------|
| `GET /me` | Check auth status, returns user or loginUrl |
| `GET /login` | Redirect to Hub OAuth |
| `GET /callback` | Receive JWT from Hub, set HttpOnly cookie |
| `POST /logout` | Clear auth cookie |

Options: `cookieDomain` for cross-subdomain SSO, `cookieMaxAge` (default 7 days).

#### `createMetricsRoutes(config)`

Owner-only metrics reporting endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /summary` | Aggregated stats, top paths/IPs |
| `GET /recent` | Last 100 requests |
| `GET /suspicious` | Flagged requests |
| `GET /ip/:ip` | Requests from specific IP |
| `GET /status` | HTTP status code breakdown |

### Types

```typescript
import type { AuthUser, RequestMetric, AggregatedStats, HubSummaryResponse } from '@codex/shared';
```

### Utils

```typescript
import { getClientIP, isInternalRequest } from '@codex/shared';

const ip = getClientIP(c); // CF-Connecting-IP > X-Forwarded-For > X-Real-IP
const internal = isInternalRequest(ip); // true for Docker bridge (172.x), localhost
```

## Subpath Imports

```typescript
import { createAuthMiddleware } from '@codex/shared/middleware';
import { createAuthRoutes } from '@codex/shared/routes';
import type { AuthUser } from '@codex/shared/types';
import { getClientIP } from '@codex/shared/utils';
```

## Security

All configuration is passed at runtime via factory functions. No secrets, credentials, or internal infrastructure details are hardcoded. See [SECURITY.md](SECURITY.md).

## Peer Dependencies

- `hono` ^4.0.0
- `jsonwebtoken` ^9.0.0

## License

MIT
