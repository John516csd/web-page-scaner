import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { checkArtifacts } from './artifact-checker.js';

test('checkArtifacts passes production SEO artifacts', async () => {
  const indexNowKey = '5b017f636ab52a762d9377df65bd4e32';
  const server = http.createServer((req, res) => {
    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('User-agent: *\nAllow: /\nSitemap: https://www.notta.ai/sitemap-0.xml\n');
      return;
    }
    if (req.url === '/sitemap-0.xml') {
      res.writeHead(200, { 'content-type': 'application/xml' });
      res.end(
        '<urlset>' +
          Array.from({ length: 101 }, (_, i) => `<url><loc>https://www.notta.ai/page-${i}</loc></url>`).join('') +
          '</urlset>'
      );
      return;
    }
    if (req.url === '/sitemap.xml') {
      res.writeHead(301, { location: '/sitemap-0.xml' });
      res.end();
      return;
    }
    if (req.url === '/llms.txt' || req.url === '/llms-full.txt') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Notta');
      return;
    }
    if (req.url === `/${indexNowKey}.txt`) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(indexNowKey);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    const result = await checkArtifacts({
      env: 'production',
      baseUrl: `http://127.0.0.1:${address.port}`,
      productionUrl: 'https://www.notta.ai',
    });

    assert.equal(result.status, 'pass');
    assert.equal(result.failed, 0);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('checkArtifacts fails test robots that exposes production sitemap', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('User-agent: *\nDisallow: /\nSitemap: https://www.notta.ai/sitemap-0.xml\n');
      return;
    }
    if (req.url === '/sitemap-0.xml') {
      res.writeHead(200, { 'content-type': 'application/xml' });
      res.end('<urlset><url><loc>http://127.0.0.1/page</loc></url></urlset>');
      return;
    }
    if (req.url === '/sitemap.xml') {
      res.writeHead(301, { location: '/sitemap-0.xml' });
      res.end();
      return;
    }
    if (req.url === '/llms.txt' || req.url === '/llms-full.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('Notta');
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    const result = await checkArtifacts({
      env: 'test',
      baseUrl: `http://127.0.0.1:${address.port}`,
      productionUrl: 'https://www.notta.ai',
      minSitemapUrls: 1,
    });

    assert.equal(result.status, 'fail');
    assert(result.items.some((item) => item.id === 'robots-test-production-sitemap' && item.status === 'fail'));
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
