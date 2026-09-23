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
