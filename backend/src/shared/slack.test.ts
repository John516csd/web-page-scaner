import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTestReport } from './slack.js';

test('formatTestReport mentions configured user only when failures exist', () => {
  const mention = '<@U12345678>';
  const passingBlocks = formatTestReport(
    'URL Tester',
    { total: 1, passed: 1, failed: 0, duration: 100 },
    [],
    mention
  );

  assert.equal(JSON.stringify(passingBlocks).includes(mention), false);

  const failingBlocks = formatTestReport(
    'URL Tester',
    { total: 1, passed: 0, failed: 1, duration: 100 },
    [
      {
        name: 'Example',
        url: 'https://example.com',
        expectedStatus: 200,
        actualStatus: 0,
        failureReason: 'Request failed',
      },
    ],
    mention
  );

  assert.equal(JSON.stringify(failingBlocks).includes(mention), true);
});
