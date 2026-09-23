# Changelog

All notable changes to this package. Consumers pin a commit or tag, so a
line here describes what a bump brings, not what is already deployed.

## 0.2.1 - 2026-09-23

Fixes from an external review of 0.2.0.

### Fixed
- `RateLimitEntry.windowMs` is optional again. 0.2.0 made it required,
  which broke consumers that build entries by hand or pass a structurally
  compatible Map (TS2345) although the runtime tolerated both.
- `isInternalRequest` no longer treats all of `172.*` as internal. Only
  RFC 1918 space (`10/8`, `172.16/12`, `192.168/16`), loopback and `::1`
  qualify; octets are validated; the IPv6-mapped forms follow the same rule.

### Added
- `createServiceAuthMiddleware` option `contextKey` (default
  `serviceUserId`), so an inline guard whose handlers read a different key
  can be replaced without touching the handlers.
- `npm run typecheck:compat`: a 0.1.0-shaped consumer fixture type-checked
  against the committed declarations, in CI.

### Changed
- The CI committed-`dist/` guard now fails on untracked output too; it
  used `git diff`, which ignores never-committed files.
- Note on 0.2.0's claim of "nothing changes without new options": bumping
  a consumer does change default metrics behavior (browser requests stop
  counting as bots, programmatic user agents start, `''` is never an IP
  key) and the rate-limit cleanup for windows over five minutes. What
  stays opt-in is the socket-address resolver and `skip`.

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
