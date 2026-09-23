# @codex/shared

Shared middleware, routes, types and utilities for a family of small
[Hono](https://hono.dev) services that sit behind one reverse proxy and one
central auth hub. Extracted from the Dodekatloi suite; nothing in here is
specific to it.

It standardizes the three kinds of caller such a suite has to tell apart:

| Principal | Credential | Where it is read | Factory |
|-----------|------------|------------------|---------|
| Browser user | HS256 JWT issued by the hub | `auth_token` HttpOnly cookie, only | `createAuthMiddleware` |
| Agent (automation acting for the owner) | Short-lived HS256 JWT with `token_use: 'agent'`, `aud`, `scope` | `Authorization: Bearer`, only | `createAgentAuthMiddleware` |
| Sibling service | Shared secret over the private network | `X-Hub-Secret` + `X-User-Id` headers | `createServiceAuthMiddleware` |

Each credential opens exactly one kind of door: a user cookie presented as a
bearer token is refused, an agent token presented as a cookie is refused, and
neither is a service credential.

On top of that: hub-proxy auth routes, a sliding-window rate limiter, request
metrics with bot and attack-pattern flags, owner-only metrics routes, and the
client-IP helper they all share.

## Install

```json
{
  "dependencies": {
    "@codex/shared": "github:davidmanzanarez/codex-shared-libraries#<commit-or-tag>"
  }
}
```

The compiled `dist/` is committed, so the package installs from git with no
build step. Pin a commit or tag: an unpinned `github:` spec resolves to the
head of `main` at the moment of the first install, and `npm ci` then keeps
whatever the lockfile recorded. Update deliberately with
`npm update @codex/shared` (or edit the pin) and commit the lockfile.

Peer dependencies: `hono` ^4, `jsonwebtoken` ^9. `@hono/node-server` is an
optional peer, needed only for the `@codex/shared/node` entry point.

## Quick start

```typescript
import { Hono } from 'hono';
import {
  createAuthMiddleware,
  createAuthRoutes,
  createServiceAuthMiddleware,
  createMetricsStore,
  createMetricsRoutes,
  createRateLimitStore,
  metricsLogger,
  rateLimiter,
  getClientIP,
} from '@codex/shared';
import { nodeSocketAddress } from '@codex/shared/node';

const app = new Hono();

// Resolve the caller's address from proxy headers, falling back to the
// socket for calls that never crossed the proxy (sibling services).
const resolveIP = (c) => getClientIP(c, { socketAddress: nodeSocketAddress });

// Observability
const metricsStore = createMetricsStore();
app.use('/api/*', metricsLogger('my-service', {
  store: metricsStore,
  resolveIP,
  skip: (c) => c.req.path === '/api/health' || c.req.path.startsWith('/api/metrics'),
}));

// Rate limiting: one store per service, one middleware per mount
const rateLimitStore = createRateLimitStore();
app.use('/api/*', rateLimiter(rateLimitStore, {
  default: { limit: 100, window: 60 },
  endpoints: { '/api/auth': { limit: 10, window: 60 } },
  resolveIP,
}));

// Users: hub-issued cookie JWT, owner-only
const { requireAuth, getUser } = createAuthMiddleware({
  jwtSecret: process.env.JWT_SECRET,
  hubPublicUrl: 'https://hub.example.com',
  frontendUrl: 'https://app.example.com',
  ownerUserId: process.env.OWNER_USER_ID,
});
app.route('/api/auth', createAuthRoutes({
  jwtSecret: process.env.JWT_SECRET,
  hubPublicUrl: 'https://hub.example.com',
  selfUrl: 'https://api.example.com',
  frontendUrl: 'https://app.example.com',
  cookieDomain: '.example.com',
}));
app.use('/api/items/*', requireAuth);

// Sibling services: shared secret, scoped to a user
const { requireServiceAuth, getServiceUserId } = createServiceAuthMiddleware({
  secret: process.env.HUB_SECRET,
});
app.use('/api/internal/*', requireServiceAuth);
app.use('/api/hub/*', requireServiceAuth);

// Owner-only metrics
app.route('/api/metrics', createMetricsRoutes({
  store: metricsStore,
  requireAuth,
  getUser,
  ownerUserId: process.env.OWNER_USER_ID,
}));
```

## Modules

### `createAuthMiddleware(config)`

Cookie-JWT middleware for browser users. Reads `auth_token` only (never a
header or query string), verifies with HS256 only, and rejects agent tokens
outright. With `ownerUserId` set, any other valid suite user gets 403; every
single-user service should set it.

Returns `{ requireAuth, optionalAuth, getUser }`. `requireAuth` answers API
paths (`/api/*`) with `401 { error, loginUrl }` and redirects page paths to
the hub login with a `returnTo`. `optionalAuth` sets the user when a valid
one is present and never blocks.

### `createAgentAuthMiddleware(config)`

Bearer-JWT middleware for automation acting on the owner's behalf. The token
must carry `token_use: 'agent'`, an `aud` equal to the configured `audience`,
the `requiredScope` inside its space-delimited `scope`, and the owner's user
id. `ownerUserId` is mandatory. Returns `{ requireAgentAuth, getAgentClaims }`;
the claims include `jti` and `grant_id` for audit trails.

### `createServiceAuthMiddleware(config)`

Shared-secret middleware for calls between services on the private network.
Compares `X-Hub-Secret` in constant time (401 on missing or wrong, same
body for both) and requires `X-User-Id` (400 without it) so internal
endpoints stay scoped to one user. Header names and the user-id requirement
are configurable. Returns `{ requireServiceAuth, getServiceUserId }`.

### `rateLimiter(store, options)`

In-memory sliding window. `default: { limit, window }` plus optional
per-prefix `endpoints` (longest match wins), `keyGenerator`, `resolveIP` and
`skip`. Sets `X-RateLimit-*` and `Retry-After`; answers 429 as JSON. Create
one store per service with `createRateLimitStore()` and share it across every
mount, otherwise counts diverge.

### `metricsLogger(serviceName, options)`

Ring-buffer request log plus running aggregates: internal vs external,
status, path, IP, bot and suspicious flags, average latency. Options:
`store`, `getUserId`, `resolveIP`, `skip`. Internal traffic (docker bridge,
loopback) is kept out of the external aggregates; pass `resolveIP` with a
socket fallback or proxy-less calls will not be recognized as internal.

### `createAuthRoutes(config)`

The hub-proxy endpoints a service mounts under `/api/auth`:

| Endpoint | Behavior |
|----------|----------|
| `GET /me` | `{ authenticated, user }` or `{ authenticated: false, loginUrl }`; clears an invalid cookie |
| `GET /login` | Redirect to the hub's OAuth entry with `returnTo` |
| `GET /callback` | Reads the shared-domain cookie the hub set, refreshes it locally, redirects to the frontend. A `?token=` query parameter is ignored. |
| `POST /logout` | Clears the cookie |

Options: `cookieDomain` for cross-subdomain sessions, `cookieMaxAge`
(default 7 days), `isProduction` (default from `NODE_ENV`).

### `createMetricsRoutes(options)`

Owner-only `GET /summary`, `/recent`, `/suspicious`, `/ip/:ip`, `/status`
over a metrics store. Takes the service's `requireAuth`, `getUser` and
`ownerUserId`.

### Utilities

- `getClientIP(c, { socketAddress? })`: last `X-Forwarded-For` hop, then
  `X-Real-IP`, then the socket address if a resolver is given, else `''`
  in production. `CF-Connecting-IP` is never trusted. IPv4-mapped IPv6
  addresses are normalized.
- `isInternalRequest(ip)`: docker bridge (`172.x`), loopback, `::1`.
- `normalizeIP(ip)`: strips the `::ffff:` prefix.
- `safeEqual(a, b)`: constant-time string comparison for secrets.

### `@codex/shared/node`

`nodeSocketAddress(c)`: the peer address under `@hono/node-server`, or
`undefined` when the request did not come through it (tests, other
runtimes). This subpath is the only place the package touches the Node
server adapter.

### Types

`AuthUser`, `AgentTokenClaims`, `RequestMetric`, `AggregatedStats`,
`HealthCheckResponse`, `HubSummaryResponse` (with the primary metric's
optional `trend`).

Subpath imports mirror the source layout: `@codex/shared/middleware`,
`/routes`, `/types`, `/utils`, `/node`.

## Trust model

The package assumes exactly one reverse proxy in front of every service,
and that the proxy appends the true client address to `X-Forwarded-For`
and overwrites any inbound `X-Real-IP`. Under that assumption the last
forwarded hop is the only address the proxy wrote, and a request with no
forwarded header at all did not come through the proxy, so it came from
inside the network. If your edge is different (Cloudflare, several proxy
layers) adapt `resolveIP`/`keyGenerator` rather than trusting a header the
package ignores on purpose.

Rate-limit and metrics stores are in-memory and per process: right for a
single instance of each service, not a distributed quota.

## Development

```bash
npm install
npm run typecheck
npm test          # builds dist/ then runs node --test against it
```

Tests need no server: they drive Hono apps through `app.request()`. CI runs
the same on Node 18, 20 and 22 and fails if `dist/` is out of date with
`src/`, because consumers load the committed build. Rebuild and commit
`dist/` with every source change.

## Security

All configuration is passed at runtime through the factories. No secrets,
hostnames or production values live in this repository; see
[SECURITY.md](SECURITY.md) before contributing.

## License

MIT
