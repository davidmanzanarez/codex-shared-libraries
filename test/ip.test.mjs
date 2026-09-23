// Client IP resolution. Runs against the compiled output in dist/, so
// `npm run build` (wired as pretest) must have run first.
process.env.NODE_ENV = 'production';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

const { getClientIP, isInternalRequest } = await import('../dist/utils/index.js');

function appEchoingIP() {
  const app = new Hono();
  app.get('/ip', (c) => c.text(getClientIP(c)));
  return app;
}

test('X-Forwarded-For: the LAST hop wins (the one our own proxy appended)', async () => {
  const res = await appEchoingIP().request('/ip', {
    headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 203.0.113.9' },
  });
  assert.equal(await res.text(), '203.0.113.9');
});

test('X-Real-IP is used when X-Forwarded-For is absent', async () => {
  const res = await appEchoingIP().request('/ip', {
    headers: { 'x-real-ip': '198.51.100.7' },
  });
  assert.equal(await res.text(), '198.51.100.7');
});

test('CF-Connecting-IP is never trusted', async () => {
  const res = await appEchoingIP().request('/ip', {
    headers: { 'cf-connecting-ip': '9.9.9.9', 'x-real-ip': '198.51.100.7' },
  });
  assert.equal(await res.text(), '198.51.100.7');
});

test('no proxy headers in production resolves to an empty string', async () => {
  const res = await appEchoingIP().request('/ip');
  assert.equal(await res.text(), '');
});

test('isInternalRequest: docker bridge and loopback are internal, public and empty are not', () => {
  assert.equal(isInternalRequest('172.18.0.5'), true);
  assert.equal(isInternalRequest('127.0.0.1'), true);
  assert.equal(isInternalRequest('::1'), true);
  assert.equal(isInternalRequest('203.0.113.9'), false);
  assert.equal(isInternalRequest(''), false);
});

test('socketAddress fallback is used only when no proxy header is present', async () => {
  const app = new Hono();
  app.get('/ip', (c) => c.text(getClientIP(c, { socketAddress: () => '172.18.0.5' })));
  assert.equal(await (await app.request('/ip')).text(), '172.18.0.5');
  assert.equal(
    await (await app.request('/ip', { headers: { 'x-forwarded-for': '203.0.113.9' } })).text(),
    '203.0.113.9',
  );
});

test('IPv4-mapped IPv6 addresses are normalized everywhere', async () => {
  const app = new Hono();
  app.get('/ip', (c) => c.text(getClientIP(c, { socketAddress: () => '::ffff:172.18.0.5' })));
  assert.equal(await (await app.request('/ip')).text(), '172.18.0.5');
  assert.equal(isInternalRequest('::ffff:172.18.0.5'), true);
  assert.equal(isInternalRequest('::ffff:203.0.113.9'), false);
});
