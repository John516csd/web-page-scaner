import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMigrationSource, parseMigrationSource } from './source-parser.js';

const NOTTA_NEXT_REPO =
  '/Users/johnnyyan/workspaces/workspace2/notta-official-website-wrapper/next-notta-official-website';

test('parseMigrationSource reads Notta migration source constants', async (t) => {
  try {
    await import('node:fs/promises').then((fs) => fs.access(NOTTA_NEXT_REPO));
  } catch {
    t.skip('Notta Next repo is not available in this workspace');
    return;
  }

  const source = await parseMigrationSource(NOTTA_NEXT_REPO);

  assert.equal(source.exactRedirects.length, 593);
  assert.equal(source.prefixRedirects.length, 3);
  assert.equal(source.externalRedirects.length, 1);
  assert.equal(source.goneUrls.length, 2092);
  assert.equal(source.noindexPaths.length, 701);
});

test('loadMigrationSource uses bundled acceptance test cases when no repo path is provided', async () => {
  const source = await loadMigrationSource();

  assert.equal(source.exactRedirects.length, 593);
  assert.equal(source.prefixRedirects.length, 3);
  assert.equal(source.externalRedirects.length, 1);
  assert.equal(source.goneUrls.length, 2092);
  assert.equal(source.noindexPaths.length, 701);
});
