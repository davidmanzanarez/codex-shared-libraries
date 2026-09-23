process.env.NODE_ENV = 'production';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

const { createRateLimitStore, rateLimiter } = await import('../dist/middleware/index.js');

function build(options) {
  const store = createRateLimitStore();
  const app = new Hono();
  app.use('/api/*', rateLimiter(store, options));
  app.get('/api/things', (c) => c.text('ok'));
  app.get('/api/import', (c) => c.text('ok'));
  return { app, store };
}

const from = (ip) => ({ headers: { 'x-real-ip': ip } });

test('requests over the limit get 429 with Retry-After and rate-limit headers', async () => {
  const { app } = build({ default: { limit: 2, window: 60 } });
  const r1 = await app.request('/api/things', from('203.0.113.1'));
  const r2 = await app.request('/api/things', from('203.0.113.1'));
  const r3 = await app.request('/api/things', from('203.0.113.1'));
  assert.equal(r1.status, 200);
  assert.equal(r1.headers.get('x-ratelimit-remaining'), '1');
  assert.equal(r2.headers.get('x-ratelimit-remaining'), '0');
  assert.equal(r3.status, 429);
  assert.equal(r3.headers.get('x-ratelimit-limit'), '2');
  assert.ok(Number(r3.headers.get('retry-after')) >= 1);
  const body = await r3.json();
  assert.equal(body.error, 'Too many requests');
});

test('buckets are keyed per client IP', async () => {
  const { app } = build({ default: { limit: 1, window: 60 } });
  assert.equal((await app.request('/api/things', from('203.0.113.1'))).status, 200);
  assert.equal((await app.request('/api/things', from('203.0.113.2'))).status, 200);
  assert.equal((await app.request('/api/things', from('203.0.113.1'))).status, 429);
});

test('per-endpoint overrides win over the default, longest prefix first', async () => {
  const { app } = build({
    default: { limit: 10, window: 60 },
    endpoints: { '/api/import': { limit: 1, window: 3600 } },
  });
  assert.equal((await app.request('/api/import', from('203.0.113.1'))).status, 200);
  assert.equal((await app.request('/api/import', from('203.0.113.1'))).status, 429);
  assert.equal((await app.request('/api/things', from('203.0.113.1'))).status, 200);
});

test('store entries remember the window that applies to them', async () => {
  const { app, store } = build({
    default: { limit: 10, window: 60 },
    endpoints: { '/api/import': { limit: 5, window: 3600 } },
  });
  await app.request('/api/import', from('203.0.113.1'));
  const [entry] = [...store.values()];
  assert.equal(entry.windowMs, 3600 * 1000);
});

test('skip() bypasses limiting entirely', async () => {
  const { app } = build({
    default: { limit: 1, window: 60 },
    skip: (c) => c.req.header('x-real-ip') === '172.18.0.9',
  });
  assert.equal((await app.request('/api/things', from('172.18.0.9'))).status, 200);
  assert.equal((await app.request('/api/things', from('172.18.0.9'))).status, 200);
});

test('a custom keyGenerator replaces the IP+prefix key', async () => {
  const { app } = build({
    default: { limit: 1, window: 60 },
    keyGenerator: (c) => c.req.header('x-api-key') ?? 'anon',
  });
  const k = (key) => ({ headers: { 'x-api-key': key } });
  assert.equal((await app.request('/api/things', k('a'))).status, 200);
  assert.equal((await app.request('/api/things', k('b'))).status, 200);
  assert.equal((await app.request('/api/things', k('a'))).status, 429);
});
