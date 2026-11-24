process.env.NODE_ENV = 'production';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';

const { createAuthRoutes } = await import('../dist/routes/index.js');

const SECRET = 'test-secret-not-a-real-one';
const USER = { id: 'owner-1', email: 'owner@example.com', name: 'Owner' };
const sign = () => jwt.sign(USER, SECRET, { algorithm: 'HS256' });
const cookie = (token) => ({ headers: { cookie: `auth_token=${token}` } });

function build() {
  const app = new Hono();
  app.route('/api/auth', createAuthRoutes({
    jwtSecret: SECRET,
    hubPublicUrl: 'https://hub.example.com',
    selfUrl: 'https://api.example.com',
    frontendUrl: 'https://app.example.com',
    cookieDomain: '.example.com',
  }));
  return app;
}

test('GET /me without a cookie reports unauthenticated with a login URL back to this service', async () => {
  const body = await (await build().request('/api/auth/me')).json();
  assert.equal(body.authenticated, false);
  assert.equal(
    body.loginUrl,
    'https://hub.example.com/api/auth/google?returnTo=' + encodeURIComponent('https://api.example.com/api/auth/callback'),
  );
});

test('GET /me with a valid cookie returns the user', async () => {
  const body = await (await build().request('/api/auth/me', cookie(sign()))).json();
  assert.equal(body.authenticated, true);
  assert.equal(body.user.id, 'owner-1');
});

test('GET /me with an invalid cookie clears it', async () => {
  const res = await build().request('/api/auth/me', cookie('garbage'));
  assert.equal((await res.json()).authenticated, false);
  const setCookie = res.headers.get('set-cookie') ?? '';
  assert.match(setCookie, /auth_token=;/);
  assert.match(setCookie, /Max-Age=0/);
  assert.match(setCookie, /Domain=\.?example\.com/i);
});

test('GET /login redirects to the hub with returnTo defaulting to the callback', async () => {
  const res = await build().request('/api/auth/login');
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /^https:\/\/hub\.example\.com\/api\/auth\/google\?returnTo=/);
});

test('GET /callback refreshes the cookie from the shared-domain cookie and redirects to the frontend', async () => {
  const res = await build().request('/api/auth/callback', cookie(sign()));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://app.example.com');
  const setCookie = res.headers.get('set-cookie') ?? '';
  assert.match(setCookie, /^auth_token=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);
});

test('GET /callback ignores a ?token= query parameter (cookie only)', async () => {
  const res = await build().request(`/api/auth/callback?token=${sign()}`);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://app.example.com?error=no_token');
  assert.equal(res.headers.get('set-cookie'), null);
});

test('POST /logout clears the cookie', async () => {
  const res = await build().request('/api/auth/logout', { method: 'POST', ...cookie(sign()) });
  assert.deepEqual(await res.json(), { success: true });
  assert.match(res.headers.get('set-cookie') ?? '', /Max-Age=0/);
});

// ---- Hub-backed sliding refresh (POST /refresh + transparent GET /me auto-refresh) ----

function buildWithRefresh(fetchFn) {
  const app = new Hono();
  app.route('/api/auth', createAuthRoutes({
    jwtSecret: SECRET,
    hubPublicUrl: 'https://hub.example.com',
    hubInternalUrl: 'http://hub.internal:6100',
    hubSecret: 'shared-hub-secret',
    selfUrl: 'https://api.example.com',
    frontendUrl: 'https://app.example.com',
    cookieDomain: '.example.com',
    fetchFn,
  }));
  return app;
}

test('POST /refresh returns 501 when hubInternalUrl/hubSecret are not configured', async () => {
  const res = await build().request('/api/auth/refresh', { method: 'POST' });
  assert.equal(res.status, 501);
});

test('POST /refresh returns 401 when ddk_refresh cookie is missing', async () => {
  const app = buildWithRefresh(async () => { throw new Error('should not call hub'); });
  const res = await app.request('/api/auth/refresh', { method: 'POST' });
  assert.equal(res.status, 401);
});

test('POST /refresh exchanges ddk_refresh via Hub and sets fresh auth_token + rotated ddk_refresh cookies', async () => {
  let seenUrl = '';
  let seenSecret = '';
  let seenBody = null;
  const freshJwt = jwt.sign(USER, SECRET, { algorithm: 'HS256', expiresIn: 86400 });
  const app = buildWithRefresh(async (url, init) => {
    seenUrl = String(url);
    seenSecret = init.headers['X-Hub-Secret'];
    seenBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      ok: true,
      accessToken: freshJwt,
      refreshToken: 'rotated-refresh-token-123',
      expiresIn: 86400,
      refreshExpiresIn: 365 * 86400,
      user: USER,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  const res = await app.request('/api/auth/refresh', {
    method: 'POST',
    headers: { cookie: 'ddk_refresh=old-refresh-token-abc', 'user-agent': 'TestBrowser/1.0' },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.authenticated, true);
  assert.equal(body.user.id, 'owner-1');
  assert.equal(seenUrl, 'http://hub.internal:6100/api/internal/sessions/refresh');
  assert.equal(seenSecret, 'shared-hub-secret');
  assert.equal(seenBody.refreshToken, 'old-refresh-token-abc');

  const cookies = res.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.startsWith(`auth_token=${freshJwt}`) && c.includes('Path=/') && c.includes('Max-Age=86400')));
  assert.ok(cookies.some((c) => c.startsWith('ddk_refresh=rotated-refresh-token-123') && c.includes('Path=/api/auth') && c.includes('HttpOnly')));
});

test('GET /me transparently auto-refreshes when auth_token is expired or missing and ddk_refresh is valid', async () => {
  const expiredJwt = jwt.sign(USER, SECRET, { algorithm: 'HS256', expiresIn: -10 });
  const freshJwt = jwt.sign(USER, SECRET, { algorithm: 'HS256', expiresIn: 86400 });
  const app = buildWithRefresh(async () => new Response(JSON.stringify({
    ok: true,
    accessToken: freshJwt,
    refreshToken: 'next-refresh-456',
    expiresIn: 86400,
    user: USER,
  }), { status: 200, headers: { 'content-type': 'application/json' } }));

  // Missing auth_token, present ddk_refresh
  const r1 = await app.request('/api/auth/me', { headers: { cookie: 'ddk_refresh=valid-tok' } });
  assert.equal(r1.status, 200);
  const b1 = await r1.json();
  assert.equal(b1.authenticated, true);
  assert.equal(b1.user.id, 'owner-1');
  assert.ok(r1.headers.getSetCookie().some((c) => c.startsWith(`auth_token=${freshJwt}`)));

  // Expired auth_token, present ddk_refresh
  const r2 = await app.request('/api/auth/me', { headers: { cookie: `auth_token=${expiredJwt}; ddk_refresh=valid-tok` } });
  assert.equal(r2.status, 200);
  const b2 = await r2.json();
  assert.equal(b2.authenticated, true);
  assert.equal(b2.user.email, 'owner@example.com');
});

test('POST /refresh clears cookies on Hub 401, but keeps ddk_refresh on Hub 503', async () => {
  const app401 = buildWithRefresh(async () => new Response(JSON.stringify({ error: 'revoked' }), { status: 401 }));
  const r401 = await app401.request('/api/auth/refresh', {
    method: 'POST',
    headers: { cookie: 'ddk_refresh=dead-tok' },
  });
  assert.equal(r401.status, 401);
  const cleared = r401.headers.getSetCookie();
  assert.ok(cleared.some((c) => c.startsWith('ddk_refresh=;') && c.includes('Max-Age=0') && c.includes('Path=/api/auth')));

  const app503 = buildWithRefresh(async () => new Response('boom', { status: 503 }));
  const r503 = await app503.request('/api/auth/refresh', {
    method: 'POST',
    headers: { cookie: 'ddk_refresh=live-tok' },
  });
  assert.equal(r503.status, 503);
  assert.equal(r503.headers.getSetCookie().length, 0);
});

test('POST /logout notifies Hub internal revoke and clears both cookies', async () => {
  let revokedToken = null;
  const app = buildWithRefresh(async (url, init) => {
    if (String(url).endsWith('/api/internal/sessions/revoke')) {
      revokedToken = JSON.parse(init.body).refreshToken;
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });

  const res = await app.request('/api/auth/logout', {
    method: 'POST',
    headers: { cookie: `auth_token=${sign()}; ddk_refresh=tok-to-revoke` },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { success: true });
  assert.equal(revokedToken, 'tok-to-revoke');
  const cleared = res.headers.getSetCookie();
  assert.ok(cleared.some((c) => c.startsWith('auth_token=;') && c.includes('Max-Age=0')));
  assert.ok(cleared.some((c) => c.startsWith('ddk_refresh=;') && c.includes('Max-Age=0') && c.includes('Path=/api/auth')));
});
