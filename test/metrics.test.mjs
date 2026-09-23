process.env.NODE_ENV = 'production';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

const {
  createMetricsStore, metricsLogger, getAggregatedStats, getRecentMetrics, getSuspiciousRequests,
} = await import('../dist/middleware/index.js');
const { getClientIP } = await import('../dist/utils/index.js');

function build(options = {}) {
  const store = createMetricsStore(50);
  const app = new Hono();
  app.use('*', metricsLogger('svc', { store, ...options }));
  app.get('/api/health', (c) => c.json({ ok: true }));
  app.get('/api/items', (c) => c.json([]));
  app.get('/wp-login.php', (c) => c.text('nope', 404));
  return { app, store };
}

const browser = (ip) => ({ headers: { 'x-real-ip': ip, 'user-agent': 'Mozilla/5.0' } });

test('records method, path, status, duration and the resolved IP', async () => {
  const { app, store } = build();
  await app.request('/api/items', browser('203.0.113.1'));
  const [m] = getRecentMetrics(store);
  assert.equal(m.service, 'svc');
  assert.equal(m.method, 'GET');
  assert.equal(m.path, '/api/items');
  assert.equal(m.status, 200);
  assert.equal(m.ip, '203.0.113.1');
  assert.equal(m.isInternal, false);
  assert.equal(m.isBot, false);
  assert.equal(getAggregatedStats(store).externalRequests, 1);
});

test('proxy-less requests are internal once a socket resolver is supplied', async () => {
  const { app, store } = build({
    resolveIP: (c) => getClientIP(c, { socketAddress: () => '172.18.0.7' }),
  });
  await app.request('/api/items', { headers: { 'user-agent': 'node' } });
  const stats = getAggregatedStats(store);
  assert.equal(stats.internalRequests, 1);
  assert.equal(stats.externalRequests, 0);
  assert.deepEqual(stats.requestsByPath, {});
});

test('an unresolved IP never becomes a requestsByIP key', async () => {
  const { app, store } = build();
  await app.request('/api/items', { headers: { 'user-agent': 'node' } });
  assert.deepEqual(Object.keys(getAggregatedStats(store).requestsByIP), []);
});

test('programmatic user agents from outside count as bots', async () => {
  const { app, store } = build();
  await app.request('/api/items', { headers: { 'x-real-ip': '203.0.113.5', 'user-agent': 'curl/8.4.0' } });
  await app.request('/api/items', { headers: { 'x-real-ip': '203.0.113.5', 'user-agent': 'node' } });
  assert.equal(getAggregatedStats(store).botRequests, 2);
});

test('skip() keeps health checks out of the store', async () => {
  const { app, store } = build({ skip: (c) => c.req.path === '/api/health' });
  await app.request('/api/health', browser('203.0.113.1'));
  await app.request('/api/items', browser('203.0.113.1'));
  assert.equal(getAggregatedStats(store).totalRequests, 1);
});

test('attack-shaped paths are flagged suspicious', async () => {
  const { app, store } = build();
  await app.request('/wp-login.php', browser('203.0.113.1'));
  const flagged = getSuspiciousRequests(store);
  assert.equal(flagged.length, 1);
  assert.match(flagged[0].suspiciousReason, /^path_match:/);
});

test('the ring buffer never exceeds maxMetrics', async () => {
  const { app, store } = build();
  for (let i = 0; i < 60; i++) await app.request('/api/items', browser('203.0.113.1'));
  assert.equal(store.metrics.length, 50);
  assert.equal(getAggregatedStats(store).totalRequests, 60);
});
