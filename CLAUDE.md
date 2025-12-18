# @dodekatloi/shared - Claude Code Context

## Package Identity

| Property | Value |
|----------|-------|
| Name | @dodekatloi/shared |
| Purpose | Shared utilities, middleware, and types for Dodekatloi services |
| Install | `"@dodekatloi/shared": "github:davidmanzanarez/codex-shared-libraries"` |

---

## What This Package Contains

### Middleware

#### `metricsLogger(serviceName, options)`
Request metrics middleware for security analysis. Tracks:
- Request timing and status codes
- Bot detection (external crawlers)
- Internal vs external traffic (Docker network detection)
- Suspicious request patterns (XSS, SQL injection, path traversal)

```typescript
import { createMetricsStore, metricsLogger, getAggregatedStats } from '@dodekatloi/shared';

const metricsStore = createMetricsStore();

app.use('*', metricsLogger('my-service', {
  store: metricsStore,
  getUserId: (c) => getUser(c)?.id,
}));

// Later, expose stats
app.get('/api/metrics/summary', (c) => c.json(getAggregatedStats(metricsStore)));
```

### Types

- `AuthUser` - Authenticated user from JWT
- `RequestMetric` - Individual request metric
- `AggregatedStats` - Aggregated statistics
- `HealthCheckResponse` - Standard health check format
- `HubSummaryResponse` - Hub dashboard summary format

### Utils

- `getClientIP(c)` - Extract client IP from request (Cloudflare, X-Forwarded-For, X-Real-IP)
- `isInternalRequest(ip)` - Check if IP is from Docker internal network

---

## Usage in Services

### Installation

Add to your service's `packages/server/package.json`:

```json
{
  "dependencies": {
    "@dodekatloi/shared": "github:davidmanzanarez/codex-shared-libraries"
  }
}
```

Then `npm install`.

### Importing

```typescript
// Import everything
import { metricsLogger, createMetricsStore, AuthUser } from '@dodekatloi/shared';

// Or import from subpaths
import { metricsLogger, createMetricsStore } from '@dodekatloi/shared/middleware';
import { AuthUser, RequestMetric } from '@dodekatloi/shared/types';
import { getClientIP } from '@dodekatloi/shared/utils';
```

---

## Development

```bash
# Install dependencies
npm install

# Build (TypeScript -> JavaScript)
npm run build

# Watch mode
npm run dev

# Type check only
npm run typecheck
```

---

## Deployment Considerations

Since this package is installed via GitHub URL, services will pull the latest version when running `npm install`.

To pin a specific version, use a commit SHA:
```json
"@dodekatloi/shared": "github:davidmanzanarez/codex-shared-libraries#abc1234"
```

Or use a tag:
```json
"@dodekatloi/shared": "github:davidmanzanarez/codex-shared-libraries#v0.1.0"
```

---

## Adding New Shared Code

1. Add code to appropriate directory (`src/middleware/`, `src/utils/`, `src/types/`)
2. Export from the directory's `index.ts`
3. Run `npm run build` to verify
4. Commit and push
5. In each service, run `npm update @dodekatloi/shared`
