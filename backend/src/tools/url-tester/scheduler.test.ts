import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeScheduleConfig } from './scheduler.js';

test('sanitizeScheduleConfig removes legacy proxy config', () => {
  const sanitized = sanitizeScheduleConfig({
    collectionId: 'redirect-tests',
    proxy: 'http://127.0.0.1:9674',
    notifySlack: true,
  });

  assert.deepEqual(sanitized, {
    collectionId: 'redirect-tests',
    notifySlack: true,
  });
  assert.equal('proxy' in sanitized, false);
});
