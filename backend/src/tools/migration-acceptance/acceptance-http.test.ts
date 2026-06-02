import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { runAcceptanceHttpCase } from './acceptance-http.js';

test('runAcceptanceHttpCase validates headers, body, and a single redirect chain', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/old?utm_source=test') {
      res.writeHead(301, { location: '/new?utm_source=test' });
      res.end();
      return;
    }

    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'x-acceptance': 'ready',
    });
    res.end('<html><head><meta name="robots" content="noindex" /></head><body>migration ready</body></html>');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`;

    const result = await runAcceptanceHttpCase({
      id: 'single-hop',
      name: 'single hop redirect',
      url: `${origin}/old?utm_source=test`,
      expectedStatus: 301,
      expectedRedirectLocation: `${origin}/new?utm_source=test`,
      maxRedirects: 1,
      expectedFinalStatusLessThan: 400,
      expectedHeaders: [{ name: 'x-acceptance', value: 'ready', final: true }],
      expectedBodyIncludes: ['migration ready'],
      expectedBodyExcludes: ['blocked by old site'],
      expectedRobotsMeta: 'noindex',
    });

    assert.equal(result.status, 'pass');
    assert.equal(result.redirectChain.length, 1);
    assert.equal(result.finalStatus, 200);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('runAcceptanceHttpCase fails redirect chains longer than the allowed maximum', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/a') {
      res.writeHead(301, { location: '/b' });
      res.end();
      return;
    }
    if (req.url === '/b') {
      res.writeHead(301, { location: '/c' });
      res.end();
      return;
    }
    res.writeHead(200);
    res.end('ok');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    const result = await runAcceptanceHttpCase({
      id: 'too-many-hops',
      name: 'too many hops',
      url: `http://127.0.0.1:${address.port}/a`,
      expectedStatus: 301,
      maxRedirects: 1,
    });

    assert.equal(result.status, 'fail');
    assert.match(result.failureReason || '', /at most 1 redirects/i);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
