import type { FastifyInstance } from 'fastify';
import { taskManager } from '../../shared/task-manager.js';
import { fetchSitemapUrls } from '../../shared/sitemap.js';
import { checkDeadLinks } from './link-checker.js';
import type {
  DeadLinkRequest,
  SiteDeadLinkRequest,
  SitemapRequest,
  SitemapResponse,
  PageDeadLinkResult,
} from './types.js';

const TOOL_ID = 'dead-link-checker';
const SITE_TOOL_ID = 'dead-link-checker-site';

taskManager.registerHandler(TOOL_ID, async (_taskId, payload, emit, _signal) => {
  const { url, options = {} } = payload as DeadLinkRequest;
  const concurrency = options.concurrency ?? 5;
  const timeoutMs = options.timeoutMs ?? 10000;
  const checkExternal = options.checkExternal ?? true;

  emit({ type: 'progress', step: 'extracting', status: 'running', message: 'Fetching page and extracting links...' });

  const result = await checkDeadLinks(
    url,
    { concurrency, timeoutMs, checkExternal },
    (event) => {
      if (event.step === 'checking') {
        emit({
          type: 'progress',
          step: 'checking',
          status: 'running',
          message: `Checking ${event.checked}/${event.total}: ${event.currentUrl}`,
          data: { checked: event.checked, total: event.total, currentUrl: event.currentUrl },
        });
      }
    }
  );

  emit({ type: 'progress', step: 'checking', status: 'done' });
  emit({ type: 'complete', result });
});

taskManager.registerHandler(SITE_TOOL_ID, async (_taskId, payload, emit, signal) => {
  const { baseUrl, paths, batchSize, startIndex, options = {} } =
    payload as SiteDeadLinkRequest;

  const concurrency = options.concurrency ?? 5;
  const timeoutMs = options.timeoutMs ?? 10000;
  const checkExternal = options.checkExternal ?? true;
  const pageConcurrency = options.pageConcurrency ?? 2;

  const batchPaths = paths.slice(startIndex, startIndex + batchSize);
  const results: PageDeadLinkResult[] = [];
  let completed = 0;

  const processPage = async (path: string) => {
    const pageUrl = new URL(path, baseUrl).toString();

    emit({
      type: 'batch_progress',
      current: ++completed,
      total: batchPaths.length,
      path,
      status: 'running',
    });

    const start = performance.now();
    try {
      const result = await checkDeadLinks(
        pageUrl,
        { concurrency, timeoutMs, checkExternal },
        () => {}
      );

      const deadCount = result.summary.dead;
      const hasErrors = result.summary.error > 0;
      const hasBlocked = result.summary.blocked > 0;
      let status: PageDeadLinkResult['status'];
      if (deadCount > 0) {
        status = 'fail';
      } else if (hasErrors || hasBlocked) {
        status = 'warn';
      } else {
        status = 'pass';
      }

      const pageResult: PageDeadLinkResult = {
        path,
        status,
        deadCount,
        totalLinks: result.summary.total,
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
      const pageResult: PageDeadLinkResult = {
        path,
        status: 'error',
        deadCount: 0,
        totalLinks: 0,
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

export function registerRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: DeadLinkRequest }>('/check', async (request, reply) => {
    const { url, options } = request.body;

    if (!url) {
      return reply.status(400).send({ error: 'url is required' });
    }

    try {
      new URL(url);
    } catch {
      return reply.status(400).send({ error: 'Invalid URL' });
    }

    const taskId = taskManager.createTask(TOOL_ID, { url, options });
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

  fastify.post<{ Body: SiteDeadLinkRequest }>('/site-check', async (request, reply) => {
    const { baseUrl, paths, batchSize = 10, startIndex = 0, options } = request.body;

    if (!baseUrl || !paths?.length) {
      return reply.status(400).send({
        error: 'baseUrl and paths are required',
      });
    }

    const taskId = taskManager.createTask(SITE_TOOL_ID, {
      baseUrl,
      paths,
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
