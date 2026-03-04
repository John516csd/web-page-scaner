import type { FastifyInstance } from 'fastify';
import type {
  DiffRequest,
  DiffResult,
  SiteDiffRequest,
  SitemapRequest,
  SitemapResponse,
  PageResult,
} from './types.js';
import { taskManager } from '../../shared/task-manager.js';
import { fetchSitemapUrls } from '../../shared/sitemap.js';
import { checkHttp } from './http-checker.js';
import { checkSeo } from './seo-checker.js';
import { checkContent } from './content-checker.js';
import { checkVisual } from './visual-checker.js';

const TOOL_ID = 'page-diff';
const SITE_TOOL_ID = 'page-diff-site';

taskManager.registerHandler(TOOL_ID, async (_taskId, payload, emit, _signal) => {
  const { urlA, urlB, checks, options } = payload as DiffRequest;

  const result: DiffResult = {
    urlA,
    urlB,
    timestamp: new Date().toISOString(),
  };

  if (checks.includes('http')) {
    emit({ type: 'progress', step: 'http', status: 'running' });
    try {
      result.http = await checkHttp(urlA, urlB);
      emit({ type: 'progress', step: 'http', status: 'done', data: result.http });
    } catch (err) {
      emit({
        type: 'progress',
        step: 'http',
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (checks.includes('seo')) {
    emit({ type: 'progress', step: 'seo', status: 'running' });
    try {
      result.seo = await checkSeo(urlA, urlB);
      emit({ type: 'progress', step: 'seo', status: 'done', data: result.seo });
    } catch (err) {
      emit({
        type: 'progress',
        step: 'seo',
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (checks.includes('content')) {
    emit({ type: 'progress', step: 'content', status: 'running' });
    try {
      result.content = await checkContent(urlA, urlB);
      emit({ type: 'progress', step: 'content', status: 'done', data: result.content });
    } catch (err) {
      emit({
        type: 'progress',
        step: 'content',
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (checks.includes('visual')) {
    emit({ type: 'progress', step: 'visual', status: 'running', message: '正在截图...' });
    try {
      result.visual = await checkVisual(urlA, urlB, options || {});
      emit({ type: 'progress', step: 'visual', status: 'done', data: result.visual });
    } catch (err) {
      emit({
        type: 'progress',
        step: 'visual',
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  emit({ type: 'complete', result });
});

taskManager.registerHandler(SITE_TOOL_ID, async (_taskId, payload, emit, signal) => {
  const { baseUrlA, baseUrlB, paths, checks, batchSize, startIndex, options } =
    payload as SiteDiffRequest;

  const pageConcurrency = options?.pageConcurrency ?? 2;
  const batchPaths = paths.slice(startIndex, startIndex + batchSize);
  const results: PageResult[] = [];
  let completed = 0;

  const processPage = async (path: string) => {
    const urlA = new URL(path, baseUrlA).toString();
    const urlB = new URL(path, baseUrlB).toString();

    emit({
      type: 'batch_progress',
      current: ++completed,
      total: batchPaths.length,
      path,
      status: 'running',
    });

    const start = performance.now();
    try {
      const result: DiffResult = {
        urlA,
        urlB,
        timestamp: new Date().toISOString(),
      };

      if (checks.includes('http')) {
        result.http = await checkHttp(urlA, urlB);
      }
      if (checks.includes('seo')) {
        result.seo = await checkSeo(urlA, urlB);
      }
      if (checks.includes('content')) {
        result.content = await checkContent(urlA, urlB);
      }
      if (checks.includes('visual')) {
        result.visual = await checkVisual(urlA, urlB, options || {});
      }

      const hasFail = hasFailures(result);
      const hasWarn = hasWarnings(result);

      const pageResult: PageResult = {
        path,
        status: hasFail ? 'fail' : hasWarn ? 'warn' : 'pass',
        duration: Math.round(performance.now() - start),
        result,
      };

      results.push(pageResult);
      emit({
        type: 'batch_progress',
        current: completed,
        total: batchPaths.length,
        path,
        status: 'done',
        data: pageResult,
      });
    } catch (err) {
      const pageResult: PageResult = {
        path,
        status: 'error',
        duration: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : String(err),
      };
      results.push(pageResult);
      emit({
        type: 'batch_progress',
        current: completed,
        total: batchPaths.length,
        path,
        status: 'done',
        data: pageResult,
      });
    }
  };

  const executing = new Set<Promise<void>>();
  for (const path of batchPaths) {
    if (signal.aborted) break;
    const p = processPage(path).then(() => { executing.delete(p); });
    executing.add(p);
    if (executing.size >= pageConcurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);

  if (!signal.aborted) {
    const nextStart = startIndex + batchSize;
    emit({
      type: 'batch_complete',
      batchIndex: Math.floor(startIndex / batchSize),
      results,
      hasMore: nextStart < paths.length,
      nextStart,
    });
  }
});

function changeRatio(added: number, removed: number, total: number): number {
  if (total === 0) return 0;
  return (added + removed) / total;
}

const CRITICAL_SEO_FIELDS = new Set(['title', 'description']);

function hasFailures(result: DiffResult): boolean {
  const httpFail = result.http?.items.some((i) => !i.match && i.name !== 'TTFB') ?? false;
  const seoFail = result.seo?.items.some((i) => !i.match && CRITICAL_SEO_FIELDS.has(i.name)) ?? false;
  const contentFail = result.content
    ? (result.content.text.similarity < 50 ||
       changeRatio(result.content.links.added.length, result.content.links.removed.length, result.content.links.countA) > 0.2 ||
       changeRatio(result.content.images.added.length, result.content.images.removed.length, result.content.images.countA) > 0.2)
    : false;
  const visualFail = result.visual?.viewports.some((v) => v.diffPercentage > 15) ?? false;
  return httpFail || seoFail || contentFail || visualFail;
}

function hasWarnings(result: DiffResult): boolean {
  const contentWarn = result.content
    ? (result.content.text.similarity < 80 ||
       result.content.links.added.length > 0 || result.content.links.removed.length > 0 ||
       result.content.images.added.length > 0 || result.content.images.removed.length > 0)
    : false;
  const visualWarn = result.visual?.viewports.some(
    (v) => v.diffPercentage > 0 && v.diffPercentage <= 15
  ) ?? false;
  return contentWarn || visualWarn;
}

export function registerRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: DiffRequest }>('/diff', async (request, reply) => {
    const { urlA, urlB, checks = ['http', 'seo', 'content', 'visual'], options } = request.body;

    if (!urlA || !urlB) {
      return reply.status(400).send({ error: 'urlA and urlB are required' });
    }

    const taskId = taskManager.createTask(TOOL_ID, { urlA, urlB, checks, options });
    return { taskId };
  });

  fastify.post<{ Body: SitemapRequest }>('/sitemap', async (request, reply) => {
    const { sitemapUrl } = request.body;

    if (!sitemapUrl) {
      return reply.status(400).send({ error: 'sitemapUrl is required' });
    }

    try {
      const pageUrls = await fetchSitemapUrls(sitemapUrl);

      const paths = pageUrls.map((url: string) => {
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      });

      const uniquePaths = [...new Set(paths)].sort();

      const result: SitemapResponse = {
        paths: uniquePaths,
        total: uniquePaths.length,
      };
      return result;
    } catch (err) {
      return reply.status(500).send({
        error: `Failed to parse sitemap: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  fastify.post<{ Body: SiteDiffRequest }>('/site-diff', async (request, reply) => {
    const { baseUrlA, baseUrlB, paths, checks, batchSize = 10, startIndex = 0, options } =
      request.body;

    if (!baseUrlA || !baseUrlB || !paths?.length) {
      return reply.status(400).send({
        error: 'baseUrlA, baseUrlB, and paths are required',
      });
    }

    const taskId = taskManager.createTask(SITE_TOOL_ID, {
      baseUrlA,
      baseUrlB,
      paths,
      checks: checks || ['http', 'seo', 'content', 'visual'],
      batchSize,
      startIndex,
      options,
    });

    return {
      taskId,
      totalPages: paths.length,
      currentBatch: { start: startIndex, end: Math.min(startIndex + batchSize, paths.length) },
    };
  });
}
