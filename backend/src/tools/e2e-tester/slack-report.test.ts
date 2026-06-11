import assert from 'node:assert/strict';
import test from 'node:test';
import { formatE2ESlackReport } from './slack-report.js';

test('formatE2ESlackReport mentions configured user only when failures exist', () => {
  const mention = '<@U12345678>';
  const passingBlocks = formatE2ESlackReport(
    'E2E Tester',
    { total: 1, passed: 1, failed: 0, duration: 100 },
    [],
    mention
  );

  assert.equal(JSON.stringify(passingBlocks).includes(mention), false);

  const failingBlocks = formatE2ESlackReport(
    'E2E Tester',
    { total: 1, passed: 0, failed: 1, duration: 100 },
    [
      {
        testCase: {
          id: 'example',
          name: 'Example',
          url: 'https://example.com',
          script: 'await page.goto("https://example.com");',
          timeout: 30000,
        },
        passed: false,
        durationMs: 100,
        error: 'Timeout',
      },
    ],
    mention
  );

  assert.equal(JSON.stringify(failingBlocks).includes(mention), true);
});
