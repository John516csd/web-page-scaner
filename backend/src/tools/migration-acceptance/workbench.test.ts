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

test('runAcceptanceWorkbench emits item-level progress between suite start and finish', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acceptance-progress-'));
  const store = new AcceptanceStore(path.join(dir, 'acceptance.db'));
  const events: Array<Record<string, unknown>> = [];

  const result = await runAcceptanceWorkbench({
    store,
    env: 'test',
    baseUrl: 'https://next.example.com',
    suites: ['functional-e2e'],
    e2eExecutor: async (testCase) => ({
      testCase,
      passed: true,
      durationMs: 8,
      consoleLogs: ['[log] ok'],
    }),
  }, (event) => events.push(event));

  const suiteRunningIndex = events.findIndex((event) =>
    event.type === 'progress' &&
    event.step === 'functional-e2e' &&
    event.status === 'running' &&
    (event.data as { kind?: string } | undefined)?.kind !== 'suite-item'
  );
  const itemRunningIndex = events.findIndex((event) =>
    event.type === 'progress' &&
    event.step === 'functional-e2e' &&
    event.status === 'running' &&
    (event.data as { kind?: string } | undefined)?.kind === 'suite-item'
  );
  const itemDoneIndex = events.findIndex((event) =>
    event.type === 'progress' &&
    event.step === 'functional-e2e' &&
    event.status === 'done' &&
    (event.data as { kind?: string } | undefined)?.kind === 'suite-item'
  );
  const suiteDoneIndex = events.findIndex((event) =>
    event.type === 'progress' &&
    event.step === 'functional-e2e' &&
    event.status === 'done' &&
    (event.data as { kind?: string } | undefined)?.kind !== 'suite-item'
  );
  const firstItemDone = events[itemDoneIndex]?.data as {
    kind?: string;
    itemId?: string;
    itemName?: string;
    index?: number;
    total?: number;
    item?: { name?: string; status?: string };
  } | undefined;

  assert.ok(suiteRunningIndex >= 0);
  assert.ok(itemRunningIndex > suiteRunningIndex);
  assert.ok(itemDoneIndex > itemRunningIndex);
  assert.ok(suiteDoneIndex > itemDoneIndex);
  assert.equal(firstItemDone?.kind, 'suite-item');
  assert.equal(firstItemDone?.index, 0);
  assert.equal(firstItemDone?.total, 3);
  assert.equal(firstItemDone?.itemName, 'Audio to Text tool shell readiness');
  assert.equal(firstItemDone?.item?.name, 'Audio to Text tool shell readiness');
  assert.equal(firstItemDone?.item?.status, 'pass');
  assert.equal(result.summary.total, 3);
  assert.equal(result.summary.passed, 3);
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

test('i18n suite checks Japanese root with Accept-Language', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acceptance-i18n-'));
  const store = new AcceptanceStore(path.join(dir, 'acceptance.db'));
  const originalFetch = globalThis.fetch;
  let rootHeaders: RequestInit['headers'];

  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    const pathname = url.pathname;
    const lang = pathname === '/' ? 'ja' : pathname.slice(1);
    if (pathname === '/') {
      rootHeaders = init?.headers;
    }

    return new Response(
      `<html lang="${lang}"><head><link rel="canonical" href="https://www.notta.ai${pathname}" /><link rel="alternate" hreflang="en" href="https://www.notta.ai/en" /></head><body>${lang}</body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }) as typeof fetch;

  try {
    const result = await runAcceptanceWorkbench({
      store,
      env: 'test',
      baseUrl: 'https://next.example.com',
      suites: ['i18n'],
    });

    assert.equal(result.summary.failed, 0);
    assert.deepEqual(rootHeaders, { 'Accept-Language': 'ja-JP,ja;q=0.9' });
  } finally {
    globalThis.fetch = originalFetch;
    store.close();
  }
});

test('functional-e2e suite runs stable migration-owned tool checks instead of full E2E collection scripts', async () => {
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
            id: 'case-home-auth-links',
            name: '日文首页 - 登录注册按钮链接验证',
            url: 'https://www.notta.ai/',
            timeout: 30000,
            script: 'throw new Error("homepage auth link checks are excluded from migration acceptance");',
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
      assert.doesNotMatch(testCase.script, /networkidle/);

      const warningScreenshot = testCase.id === 'audio-to-text-paste-link'
        ? [{
            step: 'audio paste link terminal state',
            timestamp: 20,
            image: 'png',
            status: 'warning' as const,
            metadata: {
              networkRequest: '405 https://api.example.com/file-transcribe/create-link',
              consoleMessage: 'acceptance-status=warn; visibleState=message-or-dialog; apiStatus=405 https://api.example.com/file-transcribe/create-link',
            },
          }]
        : undefined;

      return {
        testCase,
        passed: true,
        durationMs: 12,
        screenshots: warningScreenshot,
        consoleLogs: ['[log] ok'],
      };
    },
  });

  const section = result.sections[0];
  const warningItem = section?.items.find((entry) => entry.name === 'Audio to Text paste link readiness');

  assert.equal(executed.length, 3);
  assert.deepEqual(executed.map((entry) => entry.id), [
    'audio-to-text-shell',
    'audio-to-text-paste-link',
    'youtube-summarizer-submit',
  ]);
  assert.deepEqual(executed.map((entry) => entry.url), [
    'https://next.example.com/en/tools/audio-to-text-converter',
    'https://next.example.com/en/tools/audio-to-text-converter',
    'https://next.example.com/en/tools/youtube-video-summarizer',
  ]);
  assert.equal(executed.some((entry) => entry.id === 'case-ai-summary'), false);
  assert.equal(section?.suite, 'functional-e2e');
  assert.equal(section?.total, 3);
  assert.equal(section?.failed, 0);
  assert.equal(section?.warned, 1);
  assert.equal(warningItem?.status, 'warn');
  assert.equal(warningItem?.severity, 'P2');
  assert.match(warningItem?.actual || '', /api status: 405/);
  assert.match(warningItem?.failureReason || '', /message-or-dialog/);
  store.close();
});

test('functional-e2e suite reports missing core tool UI as a P1 failure', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acceptance-e2e-missing-ui-'));
  const store = new AcceptanceStore(path.join(dir, 'acceptance.db'));

  const result = await runAcceptanceWorkbench({
    store,
    env: 'test',
    baseUrl: 'https://next.example.com',
    suites: ['functional-e2e'],
    e2eExecutor: async (testCase) => ({
      testCase,
      passed: testCase.id !== 'audio-to-text-shell',
      durationMs: 25,
      error: testCase.id === 'audio-to-text-shell'
        ? 'locator.waitFor: Timeout 15000ms exceeded waiting for .ant-upload-drag'
        : undefined,
    }),
  });

  const section = result.sections[0];
  const failedItem = section?.items.find((entry) => entry.name === 'Audio to Text tool shell readiness');

  assert.equal(section?.failed, 1);
  assert.equal(failedItem?.status, 'fail');
  assert.equal(failedItem?.severity, 'P1');
  assert.match(failedItem?.failureReason || '', /required migration UI state/);
  store.close();
});

test('functional-e2e suite reports fatal browser console errors as P1 failures', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'acceptance-e2e-console-'));
  const store = new AcceptanceStore(path.join(dir, 'acceptance.db'));

  const result = await runAcceptanceWorkbench({
    store,
    env: 'test',
    baseUrl: 'https://next.example.com',
    suites: ['functional-e2e'],
    e2eExecutor: async (testCase) => ({
      testCase,
      passed: true,
      durationMs: 18,
      consoleLogs: testCase.id === 'youtube-summarizer-submit'
        ? ['[error] TypeError: Cannot read properties of undefined (reading "filename")']
        : ['[error] Failed to load resource: the server responded with a status of 405 ()'],
    }),
  });

  const section = result.sections[0];
  const failedItem = section?.items.find((entry) => entry.name === 'YouTube Summarizer submit readiness');

  assert.equal(section?.failed, 1);
  assert.equal(failedItem?.status, 'fail');
  assert.equal(failedItem?.severity, 'P1');
  assert.match(failedItem?.failureReason || '', /TypeError/);
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
