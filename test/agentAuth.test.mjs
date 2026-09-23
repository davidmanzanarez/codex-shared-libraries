process.env.NODE_ENV = 'production';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';

const { createAgentAuthMiddleware } = await import('../dist/middleware/index.js');

const SECRET = 'test-secret-not-a-real-one';
const OWNER = { id: 'owner-1', email: 'owner@example.com', name: 'Owner' };
const mint = (claims = {}, opts = {}) => jwt.sign(
  { ...OWNER, token_use: 'agent', scope: 'notes:write', ...claims },
  SECRET,
  { algorithm: 'HS256', audience: 'notes-service', expiresIn: '10m', jwtid: 'jti-1', ...opts },
);
const bearer = (token) => ({ headers: { authorization: `Bearer ${token}` } });

function build() {
  const { requireAgentAuth, getAgentClaims } = createAgentAuthMiddleware({
    jwtSecret: SECRET,
    ownerUserId: 'owner-1',
    audience: 'notes-service',
    requiredScope: 'notes:write',
  });
  const app = new Hono();
  app.post('/api/agent/notes', requireAgentAuth, (c) => c.json(getAgentClaims(c)));
  return app;
}

test('owner admission is mandatory at creation time', () => {
  assert.throws(
    () => createAgentAuthMiddleware({ jwtSecret: SECRET, audience: 'a', requiredScope: 's' }),
    /ownerUserId/,
  );
});

test('a well-formed agent token passes and its claims are exposed', async () => {
  const res = await build().request('/api/agent/notes', { method: 'POST', ...bearer(mint()) });
  assert.equal(res.status, 200);
  const claims = await res.json();
  assert.equal(claims.token_use, 'agent');
  assert.equal(claims.aud, 'notes-service');
  assert.equal(claims.jti, 'jti-1');
});

test('the token is read from the bearer header only, never from a cookie', async () => {
  const res = await build().request('/api/agent/notes', {
    method: 'POST', headers: { cookie: `auth_token=${mint()}` },
  });
  assert.equal(res.status, 401);
});

test('a token minted for another service is rejected (audience)', async () => {
  const res = await build().request('/api/agent/notes', {
    method: 'POST', ...bearer(mint({}, { audience: 'other-service' })),
  });
  assert.equal(res.status, 401);
});

test('a user-session JWT presented as bearer is the wrong door (403)', async () => {
  const session = jwt.sign(OWNER, SECRET, { algorithm: 'HS256', audience: 'notes-service' });
  const res = await build().request('/api/agent/notes', { method: 'POST', ...bearer(session) });
  assert.equal(res.status, 403);
});

test('a token for anyone but the owner is rejected', async () => {
  const res = await build().request('/api/agent/notes', { method: 'POST', ...bearer(mint({ id: 'user-2' })) });
  assert.equal(res.status, 403);
});

test('the required scope must be present in the space-delimited scope claim', async () => {
  const app = build();
  const wrong = await app.request('/api/agent/notes', { method: 'POST', ...bearer(mint({ scope: 'notes:read' })) });
  assert.equal(wrong.status, 403);
  const multi = await app.request('/api/agent/notes', { method: 'POST', ...bearer(mint({ scope: 'notes:read notes:write' })) });
  assert.equal(multi.status, 200);
});

test('expired agent tokens are rejected', async () => {
  const res = await build().request('/api/agent/notes', { method: 'POST', ...bearer(mint({}, { expiresIn: -5 })) });
  assert.equal(res.status, 401);
});
