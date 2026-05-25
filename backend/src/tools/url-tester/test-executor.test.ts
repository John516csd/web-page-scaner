import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { executeTest } from './test-executor.js';

test('executeTest retries transient request failures', async () => {
  let requests = 0;

  const server = http.createServer((_req, res) => {
    requests += 1;

    if (requests === 1) {
      res.socket?.destroy();
      return;
    }

    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    assert(address && typeof address === 'object');

    const result = await executeTest({
      id: 'transient-retry',
      name: 'Transient retry',
      description: 'Retries a connection reset once',
      url: `http://127.0.0.1:${address.port}/`,
      expectedStatus: 200,
    });

    assert.equal(result.passed, true);
    assert.equal(result.actualStatus, 200);
    assert.equal(requests, 2);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
