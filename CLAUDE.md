# @codex/shared - Claude Code Context

## ⚠️ CRITICAL: THIS IS A PUBLIC REPOSITORY ⚠️

**This repository is PUBLIC. Anyone on the internet can read this code.**

Before making ANY changes, read `SECURITY.md` in this repo.

### NEVER add to this repository:
- Secrets, API keys, tokens, passwords
- Internal IP addresses or hostnames
- Actual production configuration values
- Database connection strings
- Any sensitive or proprietary information

### This repo should ONLY contain:
- Generic, reusable middleware logic
- Type definitions
- Utility functions with NO hardcoded secrets

**When in doubt, ASK the user before adding new code.**

---

## Package Identity

| Property | Value |
|----------|-------|
| Name | @codex/shared |
| Purpose | Shared middleware, routes, types and utilities for Hono services behind one proxy and one auth hub |
| Install | `"@codex/shared": "github:davidmanzanarez/codex-shared-libraries#<commit-or-tag>"` |
| Runtime | Node >= 18.18; `dist/` is committed and is what consumers load |

---

## What This Package Contains

Three principal classes, each with its own factory, each reading its
credential from exactly one place:

| Principal | Factory | Reads | Rejects |
|-----------|---------|-------|---------|
| Browser user | `createAuthMiddleware` | `auth_token` cookie (HS256) | agent tokens, non-owner users when `ownerUserId` is set |
| Agent | `createAgentAuthMiddleware` | `Authorization: Bearer` (HS256, `token_use: 'agent'`, `aud`, `scope`) | user-session JWTs, wrong audience/scope/owner |
| Sibling service | `createServiceAuthMiddleware` | `X-Hub-Secret` (constant-time) + `X-User-Id` | missing/wrong secret (401), missing user id (400) |

Plus:

- `createAuthRoutes` - hub-proxy `/me`, `/login`, `/callback` (cookie only, `?token=` ignored), `/logout`
- `rateLimiter` + `createRateLimitStore` - sliding window, per-prefix overrides, `resolveIP`, `skip`, `keyGenerator`
- `metricsLogger` + `createMetricsStore` + `createMetricsRoutes` - ring buffer, aggregates, bot/suspicious flags, `resolveIP`, `skip`
- `getClientIP(c, { socketAddress })`, `isInternalRequest`, `normalizeIP`, `safeEqual`
- `@codex/shared/node` - `nodeSocketAddress` (the only file touching `@hono/node-server`, an optional peer)
- Types: `AuthUser`, `AgentTokenClaims`, `RequestMetric`, `AggregatedStats`, `HealthCheckResponse`, `HubSummaryResponse`

The README carries usage for each; keep the two in sync.

---

## Layout

```
src/
  middleware/   auth, agentAuth, serviceAuth, rateLimit, metrics
  routes/       auth, metrics
  types/        auth, metrics, hub
  utils/        ip, secrets
  node/         nodeSocketAddress (subpath entry point)
dist/           compiled output, COMMITTED
test/           node:test files, run against dist/
.github/        CI: typecheck, build, test on Node 18/20/22, dist-drift check
```

Every directory has an `index.ts` barrel; the root `index.ts` re-exports
all of them except `node/`, which is reached only via its subpath.

---

## Development

```bash
npm install
npm run typecheck
npm test            # pretest builds dist/, then node --test test/*.test.mjs
npm run dev         # tsc --watch
```

Tests drive Hono apps with `app.request()`; no server, no network. Each
test file sets `NODE_ENV=production` before importing so the production
code paths (empty IP without proxy headers, secure cookies) are the ones
under test. Mint JWTs in tests with `jsonwebtoken` and an obviously fake
secret.

---

## Rules for changes

1. Add code under the matching `src/` directory and export it from that
   directory's `index.ts`.
2. Add or extend a test in `test/`.
3. `npm test` - this rebuilds `dist/`. **Commit `dist/` with the source**;
   CI fails the push otherwise, and a consumer would run stale code.
4. Keep the public API backward compatible. Consumers pin a commit, and
   any of them may bump at any time; an unrelated bump must never break a
   build. New behavior goes behind a new option with the old default.
5. Nothing in a commit message, comment, test or example may name a real
   host, secret, user id or production value. Use `example.com`.
6. Update README.md and CHANGELOG.md in the same change.

---

## Releasing to consumers

Pushing to `main` deploys nothing. Each consumer's lockfile records the
exact commit it resolved, and `npm ci` installs that commit, so a change
reaches a service only when that service updates its pin:

```bash
# in the consumer
npm update @codex/shared          # or edit the #<commit-or-tag> pin
git add package-lock.json && git commit
```

Tag notable points (`git tag v0.x.y && git push --tags`) so pins can be
readable. Bump `version` in package.json with the tag.

When a change matters to security (the agent-token rejection in
`requireAuth` was one), bump every consumer promptly and say so in the
changelog; a service left on an old pin keeps the old behavior.
