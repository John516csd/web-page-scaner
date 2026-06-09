import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeSections } from './runner.js';
import type { AcceptanceSection } from './types.js';

test('summarizeSections aggregates section totals and failed status', () => {
  const sections: AcceptanceSection[] = [
    {
      id: 'artifacts',
      name: 'Artifacts',
      status: 'pass',
      total: 1,
      passed: 1,
      failed: 0,
      warned: 0,
      items: [],
    },
    {
      id: 'routes',
      name: 'Routes',
      status: 'fail',
      total: 2,
      passed: 1,
      failed: 1,
      warned: 0,
      items: [],
    },
  ];

  const summary = summarizeSections(sections, 50);

  assert.equal(summary.total, 3);
  assert.equal(summary.passed, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.warned, 0);
  assert.equal(summary.duration, 50);
});
