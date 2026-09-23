process.env.NODE_ENV = 'production';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

const { createServiceAuthMiddleware } = await import('../dist/middleware/index.js');
const { safeEqual } = await import('../dist/utils/index.js');

const SECRET = 'shared-secret-for-tests';

function build(extra = {}) {
  const { requireServiceAuth, getServiceUserId } = createServiceAuthMiddleware({ secret: SECRET, ...extra });
  const app = new Hono();
  app.use('/api/internal/*', requireServiceAuth);
  app.get('/api/internal/days', (c) => c.json({ userId: getServiceUserId(c) }));
  return app;
}

test('secret is required at creation time', () => {
  assert.throws(() => createServiceAuthMiddleware({ secret: '' }), /secret/);
});

test('missing and wrong secrets both get the same 401', async () => {
  const app = build();
  const missing = await app.request('/api/internal/days', { headers: { 'x-user-id': 'u1' } });
  const wrong = await app.request('/api/internal/days', { headers: { 'x-hub-secret': 'nope', 'x-user-id': 'u1' } });
  assert.equal(missing.status, 401);
  assert.equal(wrong.status, 401);
  assert.deepEqual(await missing.json(), await wrong.json());
});

test('a correct secret without a user id is a 400, with one it passes and exposes the id', async () => {
  const app = build();
  const noUser = await app.request('/api/internal/days', { headers: { 'x-hub-secret': SECRET } });
  assert.equal(noUser.status, 400);
  const ok = await app.request('/api/internal/days', { headers: { 'x-hub-secret': SECRET, 'x-user-id': 'u1' } });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { userId: 'u1' });
});

test('requireUserId: false admits user-agnostic calls', async () => {
  const app = build({ requireUserId: false });
  const res = await app.request('/api/internal/days', { headers: { 'x-hub-secret': SECRET } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { userId: null });
});

test('header names are configurable', async () => {
  const app = build({ secretHeader: 'X-Service-Key', userIdHeader: 'X-On-Behalf-Of' });
  const res = await app.request('/api/internal/days', {
    headers: { 'x-service-key': SECRET, 'x-on-behalf-of': 'u9' },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { userId: 'u9' });
});

test('safeEqual: equal strings true; different, empty, or missing false', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('', ''), false);
  assert.equal(safeEqual(undefined, 'abc'), false);
  assert.equal(safeEqual('abc', null), false);
});

test('contextKey lets the id land where existing handlers already read it', async () => {
  const { requireServiceAuth, getServiceUserId } = createServiceAuthMiddleware({ secret: SECRET, contextKey: 'userId' });
  const app = new Hono();
  app.use('/api/internal/*', requireServiceAuth);
  app.get('/api/internal/x', (c) => c.json({ legacy: c.get('userId'), viaGetter: getServiceUserId(c) }));
  const res = await app.request('/api/internal/x', { headers: { 'x-hub-secret': SECRET, 'x-user-id': 'u7' } });
  assert.deepEqual(await res.json(), { legacy: 'u7', viaGetter: 'u7' });
});
