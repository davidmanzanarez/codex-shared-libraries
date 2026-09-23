process.env.NODE_ENV = 'production';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

const { nodeSocketAddress } = await import('../dist/node/index.js');
const { getClientIP } = await import('../dist/utils/index.js');

const socketEnv = (remoteAddress) => ({
  incoming: { socket: { remoteAddress, remotePort: 51234, remoteFamily: 'IPv4' } },
});

test('nodeSocketAddress reads the peer address from the node-server bindings', async () => {
  const app = new Hono();
  app.get('/ip', (c) => c.text(getClientIP(c, { socketAddress: nodeSocketAddress })));
  const res = await app.request('/ip', undefined, socketEnv('172.18.0.5'));
  assert.equal(await res.text(), '172.18.0.5');
});

test('nodeSocketAddress returns undefined (not a throw) without node-server bindings', async () => {
  const app = new Hono();
  app.get('/ip', (c) => c.text(String(nodeSocketAddress(c))));
  const res = await app.request('/ip');
  assert.equal(await res.text(), 'undefined');
});
