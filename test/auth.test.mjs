process.env.NODE_ENV = 'production';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';

const { createAuthMiddleware } = await import('../dist/middleware/index.js');

const SECRET = 'test-secret-not-a-real-one';
const OWNER = { id: 'owner-1', email: 'owner@example.com', name: 'Owner' };
const OTHER = { id: 'user-2', email: 'other@example.com', name: 'Other' };
const sign = (claims, opts = {}) => jwt.sign(claims, SECRET, { algorithm: 'HS256', ...opts });
const cookie = (token) => ({ headers: { cookie: `auth_token=${token}` } });

function build(extra = {}) {
  const { requireAuth, optionalAuth, getUser } = createAuthMiddleware({
    jwtSecret: SECRET,
    hubPublicUrl: 'https://hub.example.com',
    frontendUrl: 'https://app.example.com',
    ...extra,
  });
  const app = new Hono();
  app.get('/api/me', requireAuth, (c) => c.json(getUser(c)));
  app.get('/page', requireAuth, (c) => c.text('page'));
  app.get('/api/maybe', optionalAuth, (c) => c.json({ user: getUser(c) }));
  return app;
}

test('config is validated at creation time', () => {
  assert.throws(() => createAuthMiddleware({ hubPublicUrl: 'x', frontendUrl: 'y' }), /jwtSecret/);
  assert.throws(() => createAuthMiddleware({ jwtSecret: 's', frontendUrl: 'y' }), /hubPublicUrl/);
  assert.throws(() => createAuthMiddleware({ jwtSecret: 's', hubPublicUrl: 'x' }), /frontendUrl/);
});

test('API request without a cookie gets 401 with the hub login URL', async () => {
  const res = await build().request('/api/me');
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.loginUrl, 'https://hub.example.com/api/auth/google');
});

test('page request without a cookie redirects to hub login with returnTo', async () => {
  const res = await build().request('/page');
  assert.equal(res.status, 302);
  assert.equal(
    res.headers.get('location'),
    'https://hub.example.com/api/auth/google?returnTo=' + encodeURIComponent('https://app.example.com/page'),
  );
});

test('a valid cookie JWT authenticates and exposes the user', async () => {
  const res = await build().request('/api/me', cookie(sign(OWNER)));
  assert.equal(res.status, 200);
  const user = await res.json();
  assert.equal(user.id, 'owner-1');
  assert.equal(user.email, 'owner@example.com');
});

test('the token is read from the cookie only, never from a bearer header', async () => {
  const res = await build().request('/api/me', { headers: { authorization: `Bearer ${sign(OWNER)}` } });
  assert.equal(res.status, 401);
});

test('a token signed with another secret or algorithm is rejected', async () => {
  const wrongSecret = jwt.sign(OWNER, 'some-other-secret', { algorithm: 'HS256' });
  assert.equal((await build().request('/api/me', cookie(wrongSecret))).status, 401);
  const hs512 = jwt.sign(OWNER, SECRET, { algorithm: 'HS512' });
  assert.equal((await build().request('/api/me', cookie(hs512))).status, 401);
});

test('an expired token is rejected', async () => {
  const expired = sign(OWNER, { expiresIn: -10 });
  assert.equal((await build().request('/api/me', cookie(expired))).status, 401);
});

test('agent tokens are never a user session (403)', async () => {
  const agent = sign({ ...OWNER, token_use: 'agent', scope: 'svc:write' }, { audience: 'svc' });
  assert.equal((await build().request('/api/me', cookie(agent))).status, 403);
});

test('owner admission: with ownerUserId set, other valid suite users get 403', async () => {
  const app = build({ ownerUserId: 'owner-1' });
  assert.equal((await app.request('/api/me', cookie(sign(OWNER)))).status, 200);
  assert.equal((await app.request('/api/me', cookie(sign(OTHER)))).status, 403);
});

test('optionalAuth: anonymous, invalid, agent and non-owner all continue without a user', async () => {
  const app = build({ ownerUserId: 'owner-1' });
  const bodies = await Promise.all([
    app.request('/api/maybe'),
    app.request('/api/maybe', cookie('garbage')),
    app.request('/api/maybe', cookie(sign({ ...OWNER, token_use: 'agent' }))),
    app.request('/api/maybe', cookie(sign(OTHER))),
  ].map(async (p) => (await p).json()));
  for (const b of bodies) assert.equal(b.user, null);
  const ok = await (await app.request('/api/maybe', cookie(sign(OWNER)))).json();
  assert.equal(ok.user.id, 'owner-1');
});
