import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_VISUAL_FAIL_THRESHOLD,
  DEFAULT_VISUAL_WARN_THRESHOLD,
  getVisualDiffStatus,
} from './visual-policy.js';

const visualCheckerSource = readFileSync(
  new URL('./visual-checker.ts', import.meta.url),
  'utf8'
);
const routesSource = readFileSync(new URL('./routes.ts', import.meta.url), 'utf8');
const diffFormSource = readFileSync(
  new URL('../../../../frontend/src/tools/page-diff/components/diff-form.tsx', import.meta.url),
  'utf8'
);

test('visual capture waits for render readiness instead of global network idle', () => {
  assert.doesNotMatch(visualCheckerSource, /waitUntil:\s*['"]networkidle['"]/);
  assert.match(visualCheckerSource, /waitUntil:\s*['"]domcontentloaded['"]/);
  assert.match(visualCheckerSource, /waitForStableLayout/);
  assert.match(visualCheckerSource, /image\.decode\(\)/);
  assert.match(visualCheckerSource, /Promise\.race/);
  assert.doesNotMatch(visualCheckerSource, /const\s+delay\s*=/);
});

test('site diff classification uses the configured visual threshold', () => {
  assert.doesNotMatch(routesSource, /diffPercentage\s*>\s*15/);
  assert.match(routesSource, /getVisualDiffStatus/);
});

test('visual diff policy uses strict defaults and honors an explicit fail threshold', () => {
  assert.equal(DEFAULT_VISUAL_WARN_THRESHOLD, 2);
  assert.equal(DEFAULT_VISUAL_FAIL_THRESHOLD, 5);
  assert.equal(getVisualDiffStatus(2), 'pass');
  assert.equal(getVisualDiffStatus(2.01), 'warn');
  assert.equal(getVisualDiffStatus(5), 'warn');
  assert.equal(getVisualDiffStatus(5.01), 'fail');
  assert.equal(getVisualDiffStatus(10, 15), 'warn');
  assert.equal(getVisualDiffStatus(15.01, 15), 'fail');
  assert.equal(getVisualDiffStatus(Number.NaN), 'fail');
});

test('single-page visual form uses the strict default fail threshold', () => {
  assert.doesNotMatch(diffFormSource, /failThreshold:\s*15/);
  assert.match(diffFormSource, /failThreshold:\s*5/);
  assert.match(diffFormSource, /options\.failThreshold\s*\?\?\s*5/);
  assert.doesNotMatch(diffFormSource, /options\.failThreshold\s*\|\|\s*5/);
});
