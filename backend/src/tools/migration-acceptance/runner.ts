import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import { getBrowser } from '../../shared/browser.js';
import { checkContent } from '../page-diff/content-checker.js';
import { checkHttp } from '../page-diff/http-checker.js';
import { checkSeo } from '../page-diff/seo-checker.js';
import { checkVisual } from '../page-diff/visual-checker.js';
import { e2eCollectionStore } from '../e2e-tester/collections.js';
import { executeE2ETest } from '../e2e-tester/test-executor.js';
import type { E2ETestCase, E2ETestCollection, E2ETestResult } from '../e2e-tester/types.js';
import { runAcceptanceHttpCase } from './acceptance-http.js';
import {
  CMS_SAMPLE_PATHS,
  CORE_200_PATHS,
  CTA_PATHS,
  DEFAULT_ACCEPTANCE_SUITES,
  DEFAULT_GATSBY_URL,
  DEFAULT_PRODUCTION_URL,
  I18N_LANGUAGES,
  ONLINE_MEDIA_TOOL_PATHS,
  PERFORMANCE_PATHS,
  SEO_PARITY_PATHS,
  STAGE_SUITES,
  TOOL_FLOW_PATHS,
} from './acceptance-profile.js';
import { acceptanceStore, type AcceptanceStore } from './db.js';
import { computeGoNoGo } from './go-no-go.js';
import { buildUrl, headerValue, INDEXNOW_KEY, parseXml, stableSample } from './http-utils.js';
import { loadMigrationSource } from './source-parser.js';
import type {
  AcceptanceItem,
  AcceptanceRequest,
  AcceptanceResult,
  AcceptanceRun,
  AcceptanceRunRequest,
  AcceptanceSection,
  AcceptanceStage,
  AcceptanceStatus,
  AcceptanceSuite,
  AcceptanceSummary,
  ProgressEmitter,
} from './types.js';

export interface RunAcceptanceWorkbenchOptions extends AcceptanceRunRequest {
  store?: AcceptanceStore;
  e2eCollections?: E2ETestCollection[];
  e2eExecutor?: (testCase: E2ETestCase) => Promise<E2ETestResult>;
}

export interface WorkbenchRunResult {
  run: AcceptanceRun;
  sections: AcceptanceSection[];
  items: AcceptanceItem[];
  summary: AcceptanceSummary;
  goNoGo: ReturnType<typeof computeGoNoGo>;
}

export async function runAcceptanceWorkbench(
  options: RunAcceptanceWorkbenchOptions,
  emit?: ProgressEmitter
): Promise<WorkbenchRunResult> {
  const store = options.store || acceptanceStore;
  const session = options.sessionId ? store.getSession(options.sessionId) : undefined;
  if (options.sessionId && !session) throw new Error(`Acceptance session ${options.sessionId} not found`);

  const env = options.env || session?.env || 'test';
  const baseUrl = options.baseUrl || session?.baseUrl;
  if (!baseUrl) throw new Error('baseUrl is required');
  const gatsbyUrl = options.gatsbyUrl || session?.gatsbyUrl || DEFAULT_GATSBY_URL;
  const productionUrl = options.productionUrl || session?.productionUrl || DEFAULT_PRODUCTION_URL;
  const requestedSuites = options.suites?.length ? options.suites : undefined;
  const stages = options.stages?.length
    ? options.stages
    : requestedSuites
      ? inferStagesForSuites(requestedSuites)
      : inferStagesForSuites(DEFAULT_ACCEPTANCE_SUITES);
  const suites = requestedSuites || (options.stages?.length ? defaultSuitesForStages(stages) : defaultOneClickSuites());
  const start = Date.now();

  const run = store.createRun({
    sessionId: session?.id,
    env,
    baseUrl,
    gatsbyUrl,
    productionUrl,
    stages,
    suites,
  });

  const context: SuiteContext = {
    env,
    baseUrl,
    gatsbyUrl,
    productionUrl,
    sourceRepoPath: options.sourceRepoPath || session?.sourceRepoPath,
    sampleSize: options.sampleSize || {},
    minSitemapUrls: options.minSitemapUrls,
    e2eCollections: options.e2eCollections,
    e2eExecutor: options.e2eExecutor || executeE2ETest,
  };

  const sections: AcceptanceSection[] = [];
  for (const suite of suites) {
    emit?.({ type: 'progress', step: suite, status: 'running', message: `Running ${suite}...` });
    const section = await runSuite(suite, stageForSuite(suite, stages), context);
    sections.push({ ...section, id: suite });
    const saved = store.insertSection(run.id, section);
    emit?.({ type: 'progress', step: suite, status: 'done', data: { ...section, id: saved.id } });
  }

  const summary = summarizeSections(sections, Date.now() - start);
  const persistedSections = store.listSectionsForRun(run.id);
  const items = persistedSections.flatMap((section) => section.items);
  const evidence = session ? store.listEvidence(session.id) : [];
  const signoffs = session ? store.listSignoffs(session.id) : [];
  const defects = session ? store.listDefects(session.id) : [];
  const goNoGo = computeGoNoGo({ sections: persistedSections, items, evidence, signoffs, defects });
  const finalStatus: AcceptanceStatus = summary.failed > 0 || summary.blocked ? 'fail' : summary.warned > 0 ? 'warn' : 'pass';
  const finishedRun = store.finishRun(run.id, finalStatus, summary);

  return { run: finishedRun, sections: persistedSections, items, summary, goNoGo };
}

export async function runAcceptance(
  request: AcceptanceRequest,
  emit?: ProgressEmitter
): Promise<AcceptanceResult> {
  const result = await runAcceptanceWorkbench({
    env: request.env,
    baseUrl: request.baseUrl,
    gatsbyUrl: request.gatsbyUrl,
    productionUrl: request.productionUrl,
    sourceRepoPath: request.sourceRepoPath,
    stages: request.stages,
    suites: request.suites || legacyChecksToSuites(request.checks),
    sampleSize: request.sampleSize,
    notifySlack: request.notifySlack,
    minSitemapUrls: request.minSitemapUrls,
  }, emit);

  return {
    env: request.env,
    baseUrl: request.baseUrl,
    productionUrl: request.productionUrl || DEFAULT_PRODUCTION_URL,
    timestamp: new Date().toISOString(),
    summary: result.summary,
    sections: result.sections,
    goNoGo: result.goNoGo,
    run: result.run,
  };
}

interface SuiteContext {
  env: 'test' | 'production';
  baseUrl: string;
  gatsbyUrl: string;
  productionUrl: string;
  sourceRepoPath?: string;
  sampleSize: { exactRedirects?: number; goneUrls?: number; noindex?: number };
  minSitemapUrls?: number;
  e2eCollections?: E2ETestCollection[];
  e2eExecutor: (testCase: E2ETestCase) => Promise<E2ETestResult>;
}

async function runSuite(
  suite: AcceptanceSuite,
  stage: AcceptanceStage,
  context: SuiteContext
): Promise<AcceptanceSection> {
  const start = Date.now();
  let items: AcceptanceItem[];
  switch (suite) {
    case 'build-readiness':
      items = await checkBuildReadiness(context);
      break;
    case 'smoke':
      items = await checkSmoke(context);
      break;
    case 'routing':
      items = await checkRouting(context);
      break;
    case 'seo-geo':
      items = await checkSeoGeo(context);
      break;
    case 'page-parity':
      items = await checkPageParity(context);
      break;
    case 'cms-storyblok':
      items = await checkCmsStoryblok(context);
      break;
    case 'i18n':
      items = await checkI18n(context);
      break;
    case 'functional-e2e':
      items = await checkFunctionalE2E(context);
      break;
    case 'visual-responsive':
      items = await checkVisualResponsive(context);
      break;
    case 'performance':
      items = await checkPerformance(context);
      break;
    case 'analytics':
      items = await checkAnalytics(context);
      break;
    case 'assets':
      items = await checkAssets(context);
      break;
    case 'deploy-monitoring':
    case 'rollback':
    case 'post-launch':
      items = evidenceItemsForSuite(suite);
      break;
    default:
      items = [manualItem(suite, 'Suite not implemented yet', 'P2')];
  }
  return makeWorkbenchSection(stage, suite, suiteName(suite), items, Date.now() - start);
}

async function checkBuildReadiness(context: SuiteContext): Promise<AcceptanceItem[]> {
  if (!context.sourceRepoPath) {
    return [
      manualItem('source repo path', 'sourceRepoPath not provided; local build readiness requires evidence', 'P1'),
    ];
  }

  const items: AcceptanceItem[] = [];
  const packageJsonPath = `${context.sourceRepoPath.replace(/\/$/, '')}/package.json`;
  const sstPath = `${context.sourceRepoPath.replace(/\/$/, '')}/sst.config.ts`;
  const workflowsPath = `${context.sourceRepoPath.replace(/\/$/, '')}/.github/workflows`;

  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8')) as { scripts?: Record<string, string> };
    for (const script of ['build', 'sst:deploy:test', 'sst:deploy']) {
      items.push(item({
        name: `package script ${script}`,
        url: packageJsonPath,
        status: packageJson.scripts?.[script] ? 'pass' : 'fail',
        severity: script === 'build' ? 'P0' : 'P1',
        expected: `${script} exists`,
        actual: packageJson.scripts?.[script] || 'missing',
      }));
    }
  } catch (error) {
    items.push(failItem('package.json readable', packageJsonPath, 'package.json can be parsed', error, 'P0'));
  }

  items.push(await fileExistsItem('sst.config.ts exists', sstPath, 'P1'));
  items.push(await fileExistsItem('GitHub workflow directory exists', workflowsPath, 'P1'));
  return items;
}

async function checkSmoke(context: SuiteContext): Promise<AcceptanceItem[]> {
  const cases = [
    {
      id: 'homepage-language-ja',
      name: 'homepage language routing ja',
      url: buildUrl(context.baseUrl, '/'),
      headers: { 'Accept-Language': 'ja-JP,ja;q=0.9' },
      expectedStatus: 200,
    },
    {
      id: 'homepage-language-en',
      name: 'homepage language routing en',
      url: buildUrl(context.baseUrl, '/'),
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
      expectedStatus: 302,
      expectedRedirectLocation: buildUrl(context.baseUrl, '/en'),
      maxRedirects: 1,
      expectedFinalStatus: 200,
    },
    {
      id: 'homepage-language-de',
      name: 'homepage language routing de',
      url: buildUrl(context.baseUrl, '/'),
      headers: { 'Accept-Language': 'de-DE,de;q=0.9' },
      expectedStatus: 302,
      expectedRedirectLocation: buildUrl(context.baseUrl, '/de'),
      maxRedirects: 1,
      expectedFinalStatus: 200,
    },
    ...CORE_200_PATHS.filter((path) => path !== '/').map((path) => ({
      id: `core-${path}`,
      name: `core page ${path}`,
      url: buildUrl(context.baseUrl, path),
      expectedStatus: 200,
    })),
    ...CMS_SAMPLE_PATHS.slice(0, 3).map((path) => ({
      id: `cms-${path}`,
      name: `CMS sample ${path}`,
      url: buildUrl(context.baseUrl, path),
      expectedStatus: 200,
      expectedBodyIncludes: ['<title'],
    })),
  ];

  return await runHttpItems(cases, 'P0');
}

async function checkRouting(context: SuiteContext): Promise<AcceptanceItem[]> {
  const source = await loadMigrationSource(context.sourceRepoPath);
  const items: AcceptanceItem[] = [];
  const exactRules = stableSample(source.exactRedirects, context.sampleSize.exactRedirects ?? 30);
  for (const rule of exactRules) {
    items.push(await httpItem({
      id: `exact-${rule.source}`,
      name: `exact redirect ${rule.source}`,
      url: buildUrl(context.baseUrl, rule.source),
      expectedStatus: 301,
      expectedRedirectLocation: rule.target.startsWith('http') ? rule.target : buildUrl(context.baseUrl, rule.target || '/'),
      expectedFinalStatusLessThan: 400,
    }, 'P0'));
  }

  const prefixSuffix: Record<string, string> = {
    '/article/': 'best-speech-to-text-app?utm_source=acceptance',
    '/tool/': 'ai-summary?utm_source=acceptance',
    '/en/tool/': 'youtube-video-summarizer?utm_source=acceptance',
  };
  for (const rule of source.prefixRedirects) {
    const suffix = prefixSuffix[rule.source] || 'acceptance-check?utm_source=acceptance';
    items.push(await httpItem({
      id: `prefix-${rule.source}`,
      name: `prefix redirect ${rule.source}*`,
      url: buildUrl(context.baseUrl, `${rule.source}${suffix}`),
      expectedStatus: 301,
      expectedRedirectLocation: buildUrl(context.baseUrl, `${rule.target}${suffix}`),
      maxRedirects: 1,
      expectedFinalStatusLessThan: 400,
    }, 'P0'));
  }

  for (const rule of source.externalRedirects) {
    items.push(await httpItem({
      id: `external-${rule.source}`,
      name: `external redirect ${rule.source}`,
      url: buildUrl(context.baseUrl, rule.source),
      expectedStatus: 301,
      expectedRedirectLocation: rule.target,
      maxRedirects: 1,
    }, 'P1'));
  }

  for (const path of stableSample(source.goneUrls, context.sampleSize.goneUrls ?? 30)) {
    items.push(await httpItem({
      id: `gone-${path}`,
      name: `410 ${path}`,
      url: buildUrl(context.baseUrl, path),
      expectedStatus: 410,
    }, 'P0'));
  }

  for (const path of ['/nonexistent-page-qa-check', '/zz/nonexistent-page-qa-check']) {
    items.push(await httpItem({
      id: `404-${path}`,
      name: `404 ${path}`,
      url: buildUrl(context.baseUrl, path),
      expectedStatus: 404,
      expectedFinalStatusLessThan: 500,
    }, 'P0'));
  }

  return items;
}

async function checkSeoGeo(context: SuiteContext): Promise<AcceptanceItem[]> {
  const items: AcceptanceItem[] = [];
  const robotsUrl = buildUrl(context.baseUrl, '/robots.txt');
  const robots = await httpItem({ id: 'robots', name: 'robots.txt', url: robotsUrl, expectedStatus: 200 }, 'P0');
  items.push(robots);

  try {
    const response = await fetch(robotsUrl, { redirect: 'manual' });
    const body = await response.text();
    const blocksAll = /disallow:\s*\/(?:\s|$)/i.test(body);
    const leaksProductionSitemap = body.includes(context.productionUrl);
    if (context.env === 'test') {
      items.push(item({
        name: 'test robots blocks indexing',
        url: robotsUrl,
        status: blocksAll ? 'pass' : 'fail',
        severity: 'P0',
        expected: 'Disallow: /',
        actual: blocksAll ? 'blocks indexing' : 'does not block indexing',
        failureReason: blocksAll ? undefined : 'test robots.txt must block indexing',
      }));
      items.push(item({
        name: 'test robots does not expose production sitemap',
        url: robotsUrl,
        status: leaksProductionSitemap ? 'fail' : 'pass',
        severity: 'P0',
        expected: `no ${context.productionUrl} sitemap`,
        actual: leaksProductionSitemap ? 'production sitemap found' : 'production sitemap absent',
        failureReason: leaksProductionSitemap ? 'test robots.txt exposes production sitemap' : undefined,
      }));
    } else {
      items.push(item({
        name: 'production robots allows indexing',
        url: robotsUrl,
        status: blocksAll ? 'fail' : 'pass',
        severity: 'P0',
        expected: 'no global Disallow: /',
        actual: blocksAll ? 'Disallow: / present' : 'indexing allowed',
        failureReason: blocksAll ? 'production robots.txt blocks all indexing' : undefined,
      }));
    }
  } catch (error) {
    items.push(failItem('robots policy parse', robotsUrl, 'robots policy readable', error, 'P0'));
  }

  const sitemapUrl = buildUrl(context.baseUrl, '/sitemap-0.xml');
  try {
    const response = await fetch(sitemapUrl);
    const body = await response.text();
    parseXml(body);
    const locCount = (body.match(/<loc>/g) || []).length;
    const min = context.minSitemapUrls ?? 100;
    items.push(item({
      name: 'sitemap-0.xml valid',
      url: sitemapUrl,
      status: response.status === 200 && locCount >= min ? 'pass' : 'fail',
      severity: 'P0',
      expected: `200, valid XML, >= ${min} URLs`,
      actual: `${response.status}, ${locCount} URLs`,
      failureReason: response.status !== 200 ? `sitemap-0.xml returned ${response.status}` : locCount < min ? `Expected at least ${min} URLs, got ${locCount}` : undefined,
    }));
  } catch (error) {
    items.push(failItem('sitemap-0.xml valid', sitemapUrl, '200 and valid XML', error, 'P0'));
  }

  items.push(await httpItem({
    id: '/sitemap.xml',
    name: '/sitemap.xml compatibility redirect',
    url: buildUrl(context.baseUrl, '/sitemap.xml'),
    expectedStatus: 301,
    expectedHeaders: [{ name: 'location', contains: '/sitemap-0.xml' }],
    maxRedirects: 1,
  }, 'P1'));

  for (const path of ['/llms.txt', '/llms-full.txt']) {
    items.push(await httpItem({
      id: path,
      name: path,
      url: buildUrl(context.baseUrl, path),
      expectedStatus: 200,
      expectedHeaders: path.includes('llms') ? [{ name: 'content-type', contains: 'text/plain' }] : undefined,
    }, path.includes('llms') ? 'P0' : 'P1'));
  }

  if (context.env === 'production') {
    items.push(await httpItem({
      id: 'indexnow',
      name: 'IndexNow key',
      url: buildUrl(context.baseUrl, `/${INDEXNOW_KEY}.txt`),
      expectedStatus: 200,
      expectedBodyIncludes: [INDEXNOW_KEY],
    }, 'P0'));
  }

  for (const path of SEO_PARITY_PATHS.slice(0, 6)) {
    items.push(await headParityItem(context, path));
  }

  return items;
}

async function checkPageParity(context: SuiteContext): Promise<AcceptanceItem[]> {
  const paths = SEO_PARITY_PATHS.slice(0, 8);
  const items: AcceptanceItem[] = [];
  for (const path of paths) {
    const urlA = buildUrl(context.gatsbyUrl, path);
    const urlB = buildUrl(context.baseUrl, path);
    const start = Date.now();
    try {
      const [http, seo, content] = await Promise.all([checkHttp(urlA, urlB), checkSeo(urlA, urlB), checkContent(urlA, urlB)]);
      const httpFail = http.items.some((entry) => !entry.match && entry.name !== 'TTFB');
      const criticalSeoFail = seo.items.some((entry) => !entry.match && ['title', 'description', 'canonical'].includes(entry.name));
      const contentWarn = content.text.similarity < 80;
      items.push(item({
        name: `page parity ${path}`,
        url: urlB,
        status: httpFail || criticalSeoFail ? 'fail' : contentWarn ? 'warn' : 'pass',
        severity: httpFail || criticalSeoFail ? 'P1' : 'P2',
        expected: 'HTTP and critical SEO match Gatsby; content similarity >= 80',
        actual: `http ${httpFail ? 'diff' : 'ok'}, seo ${criticalSeoFail ? 'diff' : 'ok'}, text ${content.text.similarity}%`,
        durationMs: Date.now() - start,
        failureReason: httpFail || criticalSeoFail ? 'Gatsby/Next parity has blocking differences' : undefined,
      }));
    } catch (error) {
      items.push(failItem(`page parity ${path}`, urlB, 'Gatsby/Next diff succeeds', error, 'P1', Date.now() - start));
    }
  }
  return items;
}

async function checkCmsStoryblok(context: SuiteContext): Promise<AcceptanceItem[]> {
  const items = await runHttpItems(CMS_SAMPLE_PATHS.map((path) => ({
    id: `cms-${path}`,
    name: `CMS page ${path}`,
    url: buildUrl(context.baseUrl, path),
    expectedStatus: 200,
    expectedBodyIncludes: ['<title'],
  })), 'P1');
  items.push(await httpItem({
    id: 'cms-404',
    name: 'missing CMS slug returns 404',
    url: buildUrl(context.baseUrl, '/blog/nonexistent-cms-slug-qa-check'),
    expectedStatus: 404,
  }, 'P0'));
  return items;
}

async function checkI18n(context: SuiteContext): Promise<AcceptanceItem[]> {
  const paths = I18N_LANGUAGES.map((lang) => (lang === 'ja' ? '/' : `/${lang}`));
  return await Promise.all(paths.map(async (path) => {
    const url = buildUrl(context.baseUrl, path);
    const start = Date.now();
    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      const expectedLang = path === '/' ? 'ja' : path.slice(1);
      const actualLang = $('html').attr('lang') || '';
      const hasCanonical = $('link[rel="canonical"]').length > 0;
      const hasHreflang = $('link[rel="alternate"][hreflang]').length > 0;
      const ok = response.status === 200 && actualLang.toLowerCase().startsWith(expectedLang) && hasCanonical && hasHreflang;
      return item({
        name: `i18n ${path}`,
        url,
        status: ok ? 'pass' : 'fail',
        severity: 'P1',
        expected: `200, html lang ${expectedLang}, canonical and hreflang`,
        actual: `${response.status}, lang=${actualLang || '(missing)'}, canonical=${hasCanonical}, hreflang=${hasHreflang}`,
        failureReason: ok ? undefined : 'i18n metadata mismatch',
        durationMs: Date.now() - start,
      });
    } catch (error) {
      return failItem(`i18n ${path}`, url, 'i18n page loads', error, 'P1', Date.now() - start);
    }
  }));
}

async function checkFunctionalE2E(context: SuiteContext): Promise<AcceptanceItem[]> {
  const collectionCases = selectMigrationE2ETestCases(await loadE2ECollections(context), context);
  if (collectionCases.length > 0) {
    const items: AcceptanceItem[] = [];
    for (const entry of collectionCases) {
      const result = await context.e2eExecutor(entry.testCase);
      const screenshotCount = result.screenshots?.length ?? (result.screenshot ? 1 : 0);
      items.push(item({
        id: `e2e-${result.testCase.id}`,
        name: `E2E ${entry.collectionName} / ${result.testCase.name}`,
        url: result.testCase.url,
        status: result.passed ? 'pass' : 'fail',
        severity: 'P1',
        expected: 'E2E collection test passes',
        actual: result.passed
          ? `passed; screenshots=${screenshotCount}`
          : `failed: ${result.error || 'unknown error'}; screenshots=${screenshotCount}`,
        failureReason: result.error,
        durationMs: result.durationMs,
        evidenceText: formatE2EEvidence(result),
      }));
    }
    return items;
  }

  const cases: E2ETestCase[] = [
    ...TOOL_FLOW_PATHS.slice(0, 4).map((path) => ({
      id: `tool-${path}`,
      name: `tool shell ${path}`,
      url: buildUrl(context.baseUrl, path),
      timeout: 45000,
      script: `
        await capture('loaded');
        const title = await page.title();
        assert(title.length > 0, 'page title should not be empty');
        const bodyText = await page.locator('body').innerText({ timeout: 10000 });
        assert(bodyText.length > 100, 'tool page should render meaningful content');
      `,
      tags: ['migration-acceptance'],
    })),
  ];

  const items: AcceptanceItem[] = [];
  for (const testCase of cases) {
    const result = await context.e2eExecutor(testCase);
    items.push(item({
      name: result.testCase.name,
      url: result.testCase.url,
      status: result.passed ? 'pass' : 'fail',
      severity: 'P1',
      expected: 'E2E script passes',
      actual: result.passed ? 'passed' : result.error || 'failed',
      failureReason: result.error,
      durationMs: result.durationMs,
      evidenceText: result.screenshot,
    }));
  }
  return items;
}

async function loadE2ECollections(context: SuiteContext): Promise<E2ETestCollection[]> {
  if (context.e2eCollections) return context.e2eCollections;
  await e2eCollectionStore.init();
  return e2eCollectionStore.getAll();
}

function selectMigrationE2ETestCases(
  collections: E2ETestCollection[],
  context: Pick<SuiteContext, 'env' | 'baseUrl'>
): Array<{ collectionName: string; testCase: E2ETestCase }> {
  const selected = new Map<string, { collectionName: string; testCase: E2ETestCase; rank: number }>();

  for (const collection of collections) {
    for (const testCase of collection.testCases) {
      const url = parseUrl(testCase.url);
      if (!url || !isOfficialWebsiteE2ECase(url)) continue;

      const rewritten = rewriteTestCaseForAcceptance(testCase, context);
      const key = `${url.pathname}${url.search}::${normalizeE2EName(testCase.name)}`;
      const rank = rankE2ECaseForEnv(url, context.env);
      const existing = selected.get(key);
      if (!existing || rank < existing.rank) {
        selected.set(key, {
          collectionName: collection.name,
          testCase: rewritten,
          rank,
        });
      }
    }
  }

  return Array.from(selected.values())
    .sort((a, b) => `${a.testCase.url} ${a.testCase.name}`.localeCompare(`${b.testCase.url} ${b.testCase.name}`))
    .map(({ collectionName, testCase }) => ({ collectionName, testCase }));
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function isOfficialWebsiteE2ECase(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host === 'app.notta.ai' || host === 'support.notta.ai') return false;
  if (host !== 'www.notta.ai' && !(host.startsWith('test-') && host.endsWith('.notta.ai'))) return false;
  return url.pathname === '/' || /^\/[a-z]{2}$/.test(url.pathname) || url.pathname.includes('/tools/');
}

function rewriteTestCaseForAcceptance(
  testCase: E2ETestCase,
  context: Pick<SuiteContext, 'env' | 'baseUrl'>
): E2ETestCase {
  const source = new URL(testCase.url);
  const target = new URL(context.baseUrl);
  target.pathname = source.pathname;
  target.search = source.search;
  target.hash = source.hash;
  return {
    ...testCase,
    url: target.toString(),
    script: rewriteTestCaseScriptForAcceptance(testCase.script, context.env),
  };
}

function rewriteTestCaseScriptForAcceptance(script: string, env: 'test' | 'production'): string {
  const appHost = env === 'test' ? 'test-app-wdnc5k6v5hu1i2uwb6oa.notta.ai' : 'app.notta.ai';
  return script
    .replace(/app\.notta\.ai/g, appHost)
    .replace(
      /page\.locator\('\.ant-upload-drag'\)/g,
      `page.locator('.ant-upload-drag')`
    )
    .replace(
      /page\.getByText\(\/paste a link\/i\)/g,
      `page.getByText(/paste a link/i)`
    )
    .replace(
      /page\.locator\('input\[type="text"\]'\)/g,
      `page.locator('input[type="text"]')`
    )
    .replace(
      /page\.locator\('\[class\*="skeleton"\], \[class\*="loading"\]'\)\.first\(\)/g,
      `page.locator('[class*="skeleton"], [class*="loading"]').first()`
    )
    .replace(
      /page\.locator\('\[class\*="progress"\]'\)\.first\(\)/g,
      `page.locator('[class*="progress"]').first()`
    )
    .replace(
      /selector: '\[class\*="progress"\]'/g,
      `selector: '[class*="progress"]'`
    )
    .replace(
      /page\.locator\('\[role="dialog"\], \[class\*="dialog"\]'\)/g,
      `page.locator('[role="dialog"], [class*="dialog"]')`
    )
    .replace(
      /selector: '\[role="dialog"\]'/g,
      `selector: '[role="dialog"]'`
    );
}

function rankE2ECaseForEnv(url: URL, env: 'test' | 'production'): number {
  const host = url.hostname.toLowerCase();
  if (env === 'production') return host === 'www.notta.ai' ? 0 : 1;
  return host !== 'www.notta.ai' ? 0 : 1;
}

function normalizeE2EName(name: string): string {
  return name
    .replace(/\s*\[测试环境\]\s*/g, '')
    .replace(/\s+-\s*测试环境\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function formatE2EEvidence(result: E2ETestResult): string | undefined {
  const evidence = {
    consoleLogs: result.consoleLogs?.slice(-20) || [],
    screenshots: result.screenshots?.map((screenshot) => ({
      step: screenshot.step,
      status: screenshot.status,
      url: screenshot.url,
      timestamp: screenshot.timestamp,
      metadata: screenshot.metadata,
    })) || [],
    hasFailureScreenshot: Boolean(result.screenshot),
  };
  return evidence.consoleLogs.length || evidence.screenshots.length || evidence.hasFailureScreenshot
    ? JSON.stringify(evidence)
    : undefined;
}

async function checkVisualResponsive(context: SuiteContext): Promise<AcceptanceItem[]> {
  const browser = await getBrowser();
  const items: AcceptanceItem[] = [];
  for (const path of ['/', '/pricing', '/en/pricing', '/tools/ai-summary']) {
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 375, height: 812 },
    ]) {
      const contextBrowser = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await contextBrowser.newPage();
      const url = buildUrl(context.baseUrl, path);
      const start = Date.now();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const metrics = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        const ok = metrics.scrollWidth <= metrics.clientWidth;
        items.push(item({
          name: `${viewport.name} no horizontal scroll ${path}`,
          url,
          status: ok ? 'pass' : 'fail',
          severity: 'P1',
          expected: 'no horizontal overflow',
          actual: `scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth}`,
          failureReason: ok ? undefined : 'horizontal overflow detected',
          durationMs: Date.now() - start,
        }));
      } catch (error) {
        items.push(failItem(`${viewport.name} responsive ${path}`, url, 'page renders without overflow', error, 'P1', Date.now() - start));
      } finally {
        await contextBrowser.close();
      }
    }
  }
  return items;
}

async function checkPerformance(context: SuiteContext): Promise<AcceptanceItem[]> {
  return await Promise.all(PERFORMANCE_PATHS.slice(0, 4).map(async (path) => {
    const url = buildUrl(context.baseUrl, path);
    const start = Date.now();
    try {
      const response = await fetch(url);
      await response.arrayBuffer();
      const duration = Date.now() - start;
      const ok = response.status < 400 && duration < 3000;
      return item({
        name: `performance timing ${path}`,
        url,
        status: ok ? 'pass' : 'warn',
        severity: 'P2',
        expected: 'status < 400 and response < 3000ms',
        actual: `${response.status}, ${duration}ms`,
        durationMs: duration,
      });
    } catch (error) {
      return failItem(`performance timing ${path}`, url, 'performance timing collected', error, 'P2', Date.now() - start);
    }
  }));
}

async function checkAnalytics(context: SuiteContext): Promise<AcceptanceItem[]> {
  const browser = await getBrowser();
  const pageContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await pageContext.newPage();
  const url = buildUrl(context.baseUrl, '/');
  const start = Date.now();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const result = await page.evaluate(() => ({
      dataLayer: Array.isArray((window as any).dataLayer),
      posthog: Boolean((window as any).posthog),
      gtmScript: Boolean(document.querySelector('script[src*="googletagmanager"]')),
    }));
    const ok = result.dataLayer || result.gtmScript || result.posthog;
    return [item({
      name: 'analytics bootstrap',
      url,
      status: ok ? 'pass' : 'warn',
      severity: 'P1',
      expected: 'GTM/GA/PostHog bootstrap observable',
      actual: JSON.stringify(result),
      durationMs: Date.now() - start,
    })];
  } catch (error) {
    return [failItem('analytics bootstrap', url, 'analytics observable', error, 'P1', Date.now() - start)];
  } finally {
    await pageContext.close();
  }
}

async function checkAssets(context: SuiteContext): Promise<AcceptanceItem[]> {
  const browser = await getBrowser();
  const browserContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await browserContext.newPage();
  const bad: string[] = [];
  const warnings: string[] = [];
  page.on('response', (response) => {
    const url = response.url();
    const type = response.request().resourceType();
    if (!['script', 'stylesheet', 'image', 'font'].includes(type)) return;
    const sameOrigin = new URL(url).origin === new URL(context.baseUrl).origin;
    const status = response.status();
    const contentType = response.headers()['content-type'] || '';
    if (sameOrigin && status >= 400) bad.push(`${status} ${url}`);
    if (sameOrigin && type === 'script' && !contentType.includes('javascript')) bad.push(`bad JS MIME ${contentType} ${url}`);
    if (sameOrigin && type === 'stylesheet' && !contentType.includes('css')) bad.push(`bad CSS MIME ${contentType} ${url}`);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (new URL(url).origin !== new URL(context.baseUrl).origin) warnings.push(url);
  });

  const url = buildUrl(context.baseUrl, '/');
  const start = Date.now();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    return [
      item({
        name: 'homepage static assets',
        url,
        status: bad.length ? 'fail' : warnings.length ? 'warn' : 'pass',
        severity: 'P0',
        expected: 'same-origin JS/CSS/image/font have no 404/5xx or MIME errors',
        actual: bad.length ? bad.slice(0, 5).join('; ') : warnings.length ? `${warnings.length} third-party blocked` : 'assets ok',
        failureReason: bad.length ? bad.slice(0, 5).join('; ') : undefined,
        durationMs: Date.now() - start,
      }),
    ];
  } catch (error) {
    return [failItem('homepage static assets', url, 'assets can be collected', error, 'P0', Date.now() - start)];
  } finally {
    await browserContext.close();
  }
}

function evidenceItemsForSuite(suite: AcceptanceSuite): AcceptanceItem[] {
  void suite;
  return [];
}

async function runHttpItems(cases: Parameters<typeof runAcceptanceHttpCase>[0][], severity: AcceptanceItem['severity']): Promise<AcceptanceItem[]> {
  return await Promise.all(cases.map((testCase) => httpItem(testCase, severity || 'P2')));
}

async function httpItem(testCase: Parameters<typeof runAcceptanceHttpCase>[0], severity: AcceptanceItem['severity']): Promise<AcceptanceItem> {
  const result = await runAcceptanceHttpCase(testCase);
  return item({
    id: result.id,
    name: result.name,
    url: result.url,
    status: result.status,
    severity,
    expected: result.expected,
    actual: result.actual,
    durationMs: result.durationMs,
    failureReason: result.failureReason,
    responseHeaders: result.responseHeaders,
  });
}

async function headParityItem(context: SuiteContext, path: string): Promise<AcceptanceItem> {
  const urlA = buildUrl(context.gatsbyUrl, path);
  const urlB = buildUrl(context.baseUrl, path);
  const start = Date.now();
  try {
    const [a, b] = await Promise.all([fetch(urlA), fetch(urlB)]);
    const [$a, $b] = await Promise.all([a.text(), b.text()]).then(([htmlA, htmlB]) => [cheerio.load(htmlA), cheerio.load(htmlB)]);
    const fields = [
      ['title', $a('title').text(), $b('title').text()],
      ['description', $a('meta[name="description"]').attr('content') || '', $b('meta[name="description"]').attr('content') || ''],
      ['canonical', $a('link[rel="canonical"]').attr('href') || '', $b('link[rel="canonical"]').attr('href') || ''],
      ['hreflang', String($a('link[rel="alternate"][hreflang]').length), String($b('link[rel="alternate"][hreflang]').length)],
      ['JSON-LD', String($a('script[type="application/ld+json"]').length), String($b('script[type="application/ld+json"]').length)],
    ];
    const mismatches = fields.filter(([, left, right]) => left !== right).map(([name]) => name);
    return item({
      name: `head parity ${path}`,
      url: urlB,
      status: mismatches.length ? 'warn' : 'pass',
      severity: 'P1',
      expected: 'head metadata matches Gatsby',
      actual: mismatches.length ? `mismatch: ${mismatches.join(', ')}` : 'matches',
      durationMs: Date.now() - start,
    });
  } catch (error) {
    return failItem(`head parity ${path}`, urlB, 'head metadata comparable', error, 'P1', Date.now() - start);
  }
}

async function fileExistsItem(name: string, path: string, severity: AcceptanceItem['severity']): Promise<AcceptanceItem> {
  try {
    await fs.access(path);
    return item({ name, url: path, status: 'pass', severity, expected: 'exists', actual: 'exists' });
  } catch {
    return item({ name, url: path, status: 'fail', severity, expected: 'exists', actual: 'missing', failureReason: `${path} is missing` });
  }
}

export function summarizeSections(sections: AcceptanceSection[], duration: number): AcceptanceSummary {
  return {
    total: sections.reduce((sum, section) => sum + section.total, 0),
    passed: sections.reduce((sum, section) => sum + section.passed, 0),
    failed: sections.reduce((sum, section) => sum + section.failed, 0),
    warned: sections.reduce((sum, section) => sum + section.warned, 0),
    blocked: sections.reduce((sum, section) => sum + (section.blocked || 0), 0),
    duration,
  };
}

export function defaultSuitesForStages(stages: AcceptanceStage[]): AcceptanceSuite[] {
  return [...new Set(stages.flatMap((stage) => STAGE_SUITES[stage]))];
}

export function defaultOneClickSuites(): AcceptanceSuite[] {
  return [...DEFAULT_ACCEPTANCE_SUITES];
}

function inferStagesForSuites(suites: AcceptanceSuite[]): AcceptanceStage[] {
  const stages = (Object.keys(STAGE_SUITES) as AcceptanceStage[]).filter((stage) =>
    suites.some((suite) => STAGE_SUITES[stage].includes(suite))
  );
  return stages.length ? stages : (['T1'] as AcceptanceStage[]);
}

function stageForSuite(suite: AcceptanceSuite, selectedStages: AcceptanceStage[]): AcceptanceStage {
  return selectedStages.find((stage) => STAGE_SUITES[stage].includes(suite))
    || (Object.keys(STAGE_SUITES) as AcceptanceStage[]).find((stage) => STAGE_SUITES[stage].includes(suite))
    || selectedStages[0]
    || 'T1';
}

function legacyChecksToSuites(checks: AcceptanceRequest['checks']): AcceptanceSuite[] | undefined {
  if (!checks?.length) return undefined;
  const map: Record<string, AcceptanceSuite> = {
    artifacts: 'seo-geo',
    headers: 'seo-geo',
    routes: 'routing',
    assets: 'assets',
  };
  return [...new Set(checks.map((check) => map[check]).filter(Boolean))];
}

function makeWorkbenchSection(
  stage: AcceptanceStage,
  suite: AcceptanceSuite,
  name: string,
  items: AcceptanceItem[],
  durationMs: number
): AcceptanceSection {
  const failed = items.filter((entry) => entry.status === 'fail').length;
  const warned = items.filter((entry) => entry.status === 'warn').length;
  const blocked = items.filter((entry) => entry.status === 'blocked').length;
  const passed = items.filter((entry) => entry.status === 'pass').length;
  const manual = items.filter((entry) => entry.status === 'manual' || entry.status === 'pending').length;
  return {
    id: suite,
    stage,
    suite,
    name,
    status: failed > 0 ? 'fail' : blocked > 0 ? 'blocked' : warned > 0 ? 'warn' : manual > 0 ? 'manual' : 'pass',
    total: items.length,
    passed,
    failed,
    warned,
    blocked,
    durationMs,
    items: items.map((entry) => ({ ...entry, stage, suite })),
  };
}

function item(input: Partial<AcceptanceItem> & {
  name: string;
  expected: string;
  actual: string;
  status: AcceptanceStatus;
}): AcceptanceItem {
  return {
    id: input.id || input.name,
    name: input.name,
    url: input.url,
    status: input.status,
    severity: input.severity || 'P2',
    expected: input.expected,
    actual: input.actual,
    durationMs: input.durationMs || 0,
    failureReason: input.failureReason,
    responseHeaders: input.responseHeaders,
    evidenceUrl: input.evidenceUrl,
    evidenceText: input.evidenceText,
  };
}

function failItem(
  name: string,
  url: string,
  expected: string,
  error: unknown,
  severity: AcceptanceItem['severity'],
  durationMs = 0
): AcceptanceItem {
  return item({
    name,
    url,
    status: 'fail',
    severity,
    expected,
    actual: 'failed',
    failureReason: error instanceof Error ? error.message : String(error),
    durationMs,
  });
}

function manualItem(name: string, expected: string, severity: AcceptanceItem['severity']): AcceptanceItem {
  return item({
    name,
    status: 'manual',
    severity,
    expected,
    actual: 'manual evidence required',
  });
}

function suiteName(suite: AcceptanceSuite): string {
  const names: Record<AcceptanceSuite, string> = {
    'build-readiness': 'T0 Build & Deploy Readiness',
    smoke: 'T1 Automated Smoke',
    routing: 'Routing / Redirect / 410 / 404',
    'seo-geo': 'SEO / GEO',
    'page-parity': 'Page Parity',
    'cms-storyblok': 'CMS / Storyblok',
    i18n: 'Multi-language / Localization',
    'functional-e2e': 'Functional E2E',
    'visual-responsive': 'Visual / Responsive',
    performance: 'Performance',
    analytics: 'Analytics / Conversion',
    assets: 'Static Assets',
    'deploy-monitoring': 'Deploy / Monitoring Evidence',
    rollback: 'Rollback Evidence',
    'post-launch': 'Post-launch Observation',
  };
  return names[suite];
}
