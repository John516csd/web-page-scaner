import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AcceptanceStore } from './db.js';
import { computeGoNoGo } from './go-no-go.js';
import { formatMarkdownReport } from './routes.js';
import { defaultOneClickSuites, runAcceptanceWorkbench } from './runner.js';
import type { E2ETestCase } from '../e2e-tester/types.js';

test('AcceptanceStore creates sessions and persists evidence, signoffs, and defects', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acceptance-db-'));
  const store = new AcceptanceStore(path.join(dir, 'acceptance.db'));

  const session = store.createSession({
    name: 'Launch readiness',
    env: 'test',
    baseUrl: 'https://next.example.com',
    gatsbyUrl: 'https://www.notta.ai',
    productionUrl: 'https://www.notta.ai',
    sitemapUrl: 'https://www.notta.ai/sitemap.xml',
    cloudfrontDistribution: 'E123',
    commitSha: 'abc123',
  });

  store.upsertEvidence(session.id, {
    moduleId: 'cloudfront-dns-acm',
    name: 'CloudFront / DNS / ACM',
    owner: 'Ops',
    required: true,
    status: 'pass',
    evidenceUrl: 'https://example.com/evidence',
    notes: 'Distribution deployed',
  });
  store.upsertSignoff(session.id, {
    moduleId: 'cloudfront-dns-acm',
    status: 'pass',
    owner: 'Ops',
    signer: 'Johnny',
    notes: 'OK to launch',
  });
  store.upsertEvidence(session.id, {
    moduleId: 'cloudfront-dns-acm',
    status: 'waived',
  });
  store.createDefect(session.id, {
    title: 'Broken pricing CTA',
    severity: 'P1',
    status: 'open',
    owner: 'QA',
  });

  const detail = store.getSessionDetail(session.id);

  assert.equal(detail?.session.name, 'Launch readiness');
  assert.equal(detail?.evidence.length, 1);
  assert.equal(detail?.evidence[0]?.name, 'CloudFront / DNS / ACM');
  assert.equal(detail?.evidence[0]?.status, 'waived');
  assert.equal(detail?.signoffs.length, 1);
  assert.equal(detail?.defects.length, 1);
  store.close();
});

test('computeGoNoGo only blocks on P0/P1 automation failures', () => {
  const status = computeGoNoGo({
    sections: [
      {
        id: 1,
        runId: 1,
        stage: 'T1',
        suite: 'smoke',
        name: 'Smoke',
        status: 'fail',
        total: 1,
        passed: 0,
        failed: 1,
        warned: 0,
        blocked: 0,
        durationMs: 10,
        items: [],
      },
    ],
    items: [
      {
        id: 1,
        sectionId: 1,
        stage: 'T1',
        suite: 'smoke',
        name: 'homepage',
        status: 'fail',
        severity: 'P0',
        url: 'https://next.example.com/',
        expected: '200',
        actual: '500',
        failureReason: 'Expected 200, got 500',
        durationMs: 10,
      },
    ],
    evidence: [
      {
        id: 1,
        sessionId: 1,
        moduleId: 'gsc-seo',
        name: 'GSC / SEO',
        owner: 'SEO',
        required: true,
        status: 'pending',
      },
    ],
    signoffs: [
      {
        id: 1,
        sessionId: 1,
        moduleId: 'final-go',
        owner: 'PM',
        status: 'pending',
      },
    ],
    defects: [
      {
        id: 1,
        sessionId: 1,
        title: 'Manual launch concern',
        severity: 'P1',
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(status.decision, 'no-go');
  assert.deepEqual(status.blockers.map((item) => item.type), ['automation']);
  assert.equal(status.missingEvidence.length, 0);
  assert.equal(status.openP0P1Defects.length, 0);
});

test('computeGoNoGo allows missing evidence and manual defects when automation passes', () => {
  const status = computeGoNoGo({
    sections: [],
    items: [
      {
        id: 1,
        name: 'minor warning',
        status: 'warn',
        severity: 'P1',
        expected: 'stable',
        actual: 'warning',
        durationMs: 1,
      },
    ],
    evidence: [
      {
        id: 1,
        sessionId: 1,
        moduleId: 'cloudfront-dns-acm',
        name: 'CloudFront / DNS / ACM',
        required: true,
        status: 'pending',
      },
    ],
    signoffs: [
      {
        id: 1,
        sessionId: 1,
        moduleId: 'final-go',
        status: 'pending',
      },
    ],
    defects: [
      {
        id: 1,
        sessionId: 1,
        title: 'Manual issue',
        severity: 'P1',
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(status.decision, 'go');
  assert.equal(status.blockers.length, 0);
});

test('runAcceptanceWorkbench persists selected suites and returns a no-go summary for failing smoke', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acceptance-runner-'));
  const store = new AcceptanceStore(path.join(dir, 'acceptance.db'));
  const session = store.createSession({
    name: 'Runner session',
    env: 'test',
    baseUrl: 'http://127.0.0.1:9',
    gatsbyUrl: 'https://www.notta.ai',
    productionUrl: 'https://www.notta.ai',
  });

  const result = await runAcceptanceWorkbench({
    store,
    sessionId: session.id,
    stages: ['T1'],
    suites: ['smoke'],
    sampleSize: { exactRedirects: 0, goneUrls: 0 },
  });

  const detail = store.getSessionDetail(session.id);

  assert.equal(result.run.status, 'fail');
  assert.equal(result.goNoGo.decision, 'no-go');
  assert.equal(detail?.runs.length, 1);
  assert.equal(detail?.sections.some((section) => section.suite === 'smoke'), true);
  store.close();
});

test('runAcceptanceWorkbench infers stage from selected suite when stages are omitted', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acceptance-stage-'));
  const store = new AcceptanceStore(path.join(dir, 'acceptance.db'));

  const result = await runAcceptanceWorkbench({
    store,
    env: 'test',
    baseUrl: 'https://next.example.com',
    suites: ['post-launch'],
  });

  assert.equal(result.sections[0]?.stage, 'T4');
  store.close();
});

test('defaultOneClickSuites contains only migration automation suites', () => {
  const suites = defaultOneClickSuites();

  assert.deepEqual(suites, [
    'smoke',
    'routing',
    'seo-geo',
    'assets',
    'page-parity',
    'cms-storyblok',
    'i18n',
    'functional-e2e',
    'visual-responsive',
    'analytics',
    'performance',
  ]);
  assert.equal(suites.includes('deploy-monitoring'), false);
  assert.equal(suites.includes('rollback'), false);
  assert.equal(suites.includes('post-launch'), false);
});

test('functional-e2e suite reuses E2E collection cases and rewrites them to the acceptance base URL', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acceptance-e2e-'));
  const store = new AcceptanceStore(path.join(dir, 'acceptance.db'));
  const executed: E2ETestCase[] = [];

  const result = await runAcceptanceWorkbench({
    store,
    env: 'test',
    baseUrl: 'https://next.example.com',
    suites: ['functional-e2e'],
    e2eCollections: [
      {
        id: 'collection-1',
        name: 'Migration tool flows',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        testCases: [
          {
            id: 'case-ai-summary',
            name: 'AI Summary real flow',
            url: 'https://www.notta.ai/tools/ai-summary',
            timeout: 90000,
            script: 'assert("https://app.notta.ai/signup".includes("app.notta.ai")); await page.waitForLoadState("networkidle");',
          },
          {
            id: 'case-external',
            name: 'External app should not be migrated',
            url: 'https://app.notta.ai/dashboard',
            timeout: 90000,
            script: 'throw new Error("should not run");',
          },
        ],
      },
    ],
    e2eExecutor: async (testCase) => {
      executed.push(testCase);
      return {
        testCase,
        passed: true,
        durationMs: 12,
        consoleLogs: ['[log] ok'],
      };
    },
  });

  const section = result.sections[0];

  assert.equal(executed.length, 1);
  assert.equal(executed[0]?.id, 'case-ai-summary');
  assert.equal(executed[0]?.url, 'https://next.example.com/tools/ai-summary');
  assert.match(executed[0]?.script || '', /test-app-wdnc5k6v5hu1i2uwb6oa\.notta\.ai/);
  assert.equal(section?.suite, 'functional-e2e');
  assert.equal(section?.total, 1);
  assert.equal(section?.items[0]?.name, 'E2E Migration tool flows / AI Summary real flow');
  assert.equal(section?.items[0]?.actual, 'passed; screenshots=0');
  store.close();
});

test('formatMarkdownReport excludes manual evidence and signoff sections', () => {
  const report = formatMarkdownReport({
    session: {
      id: 1,
      name: 'Acceptance',
      env: 'test',
      baseUrl: 'https://next.example.com',
      gatsbyUrl: 'https://www.notta.ai',
      productionUrl: 'https://www.notta.ai',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    runs: [],
    sections: [],
    items: [],
    evidence: [
      {
        id: 1,
        sessionId: 1,
        moduleId: 'github-actions',
        name: 'GitHub Actions test/prod deployment',
        owner: 'Frontend',
        required: true,
        status: 'pending',
      },
    ],
    signoffs: [
      {
        id: 1,
        sessionId: 1,
        moduleId: 'final-go',
        status: 'pending',
      },
    ],
    defects: [],
    goNoGo: {
      decision: 'go',
      blockers: [],
      missingEvidence: [],
      openP0P1Defects: [],
    },
  });

  assert.equal(report.includes('GitHub Actions'), false);
  assert.equal(report.includes('CloudFront'), false);
  assert.equal(report.includes('Evidence & Signoff'), false);
});
