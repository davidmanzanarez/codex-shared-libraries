# Changelog

All notable changes to this package. Consumers pin a commit or tag, so a
line here describes what a bump brings, not what is already deployed.

## 0.2.0 - 2026-09-23

### Added
- `createServiceAuthMiddleware`: shared-secret auth for service-to-service
  calls (constant-time compare, required user-id header, configurable
  header names). The third principal class next to users and agents.
- `safeEqual`: constant-time string comparison for secrets.
- `getClientIP` option `socketAddress`: fall back to the transport peer
  address when no proxy header is present, so calls that bypass the proxy
  resolve to their real network address instead of `''`.
- `@codex/shared/node` subpath with `nodeSocketAddress` for
  `@hono/node-server` (optional peer dependency).
- `metricsLogger` options `resolveIP` and `skip`; `rateLimiter` option
  `resolveIP`.
- `HubSummaryResponse.metrics.primary.trend`.
- Exported `RateLimitStore` / `RateLimitEntry` types.
- Test suite (`node --test`, 53 tests) and CI on Node 18/20/22 with a
  committed-`dist/` drift check.
- `engines.node >= 18.18`, `sideEffects: false`.

### Fixed
- Metrics: the bot pattern `moz` matched every `Mozilla/5.0` user agent, so
  real browsers were counted as bots. Now matches Moz's actual crawlers
  (`rogerbot`, `dotbot`).
- Metrics: an unresolved IP (`''`) is no longer admitted as a
  `requestsByIP` key.
- Rate limiter: the periodic store cleanup dropped timestamps older than a
  fixed five minutes, silently resetting any limit configured with a longer
  window. Entries now remember their own window.
- Rate limiter: the oldest timestamp is read directly instead of spreading
  the array into `Math.min`.
- IPv4-mapped IPv6 addresses (`::ffff:a.b.c.d`) are normalized so internal
  network patterns can match them.

### Changed
- Programmatic user agents (`node`, `undici`, `curl`, `wget`,
  `python-requests`, `go-http-client`, `okhttp`) from outside the network
  now count as bots in the metrics aggregates.
- Dev dependencies refreshed (hono 4.13, TypeScript 5.9). Peer ranges are
  unchanged.
- README rewritten around the three-principal model; CLAUDE.md documents
  the committed-`dist/` rule and the consumer bump procedure.

## 0.1.0

Initial extraction: cookie-JWT user middleware with owner admission,
agent-token middleware, hub-proxy auth routes, sliding-window rate
limiter, request metrics middleware and routes, client-IP helpers, shared
types.
