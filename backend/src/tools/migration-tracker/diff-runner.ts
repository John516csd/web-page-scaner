import { taskManager } from '../../shared/task-manager.js';
import { fetchSitemapUrls } from '../../shared/sitemap.js';
import { checkHttp } from '../page-diff/http-checker.js';
import { checkSeo } from '../page-diff/seo-checker.js';
import { checkContent } from '../page-diff/content-checker.js';
import {
  getSession,
  bulkInsertPagePaths,
  getPendingPages,
  countTotalPages,
  updatePageResult,
  updatePageScanStatus,
  updateSessionScanStatus,
  getSessionStats,
} from './db.js';
import type { DiffStatus } from './types.js';
import type { DiffResult } from '../page-diff/types.js';

const SCAN_TOOL_ID = 'migration-tracker-scan';
const CONCURRENCY = 3;

taskManager.registerHandler(SCAN_TOOL_ID, async (_taskId, payload, emit, signal) => {
  const { sessionId, batchSize = 50 } = payload as { sessionId: number; batchSize: number };

  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  updateSessionScanStatus(sessionId, 'running');

  // Only fetch sitemap if no pages have been loaded yet for this session
  const existingTotal = countTotalPages(sessionId);
  if (existingTotal === 0) {
    emit({ type: 'progress', step: 'sitemap', status: 'running', message: '正在获取 sitemap...' });
    try {
      const sitemapUrl = session.sitemap_url || `${session.gatsby_base_url.replace(/\/$/, '')}/sitemap.xml`;
      const urls = await fetchSitemapUrls(sitemapUrl);
      const allPaths = [...new Set(
        urls.map((u) => {
          try { return new URL(u).pathname; } catch { return u; }
        })
      )].sort();

      bulkInsertPagePaths(sessionId, allPaths);
      emit({ type: 'progress', step: 'sitemap', status: 'done', data: { total: allPaths.length } });
    } catch (err) {
      updateSessionScanStatus(sessionId, 'error');
      emit({ type: 'progress', step: 'sitemap', status: 'error', message: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  // Take only `batchSize` pending pages
  const batchPages = getPendingPages(sessionId, batchSize);
  const batchTotal = batchPages.length;
  let completed = 0;

  const processPage = async (page: { id: number; path: string }) => {
    if (signal.aborted) return;

    updatePageScanStatus(page.id, 'running');
    const urlA = new URL(page.path, session.gatsby_base_url).toString();
    const urlB = new URL(page.path, session.nextjs_base_url).toString();

    try {
      const result: DiffResult = { urlA, urlB, timestamp: new Date().toISOString() };

      result.http = await checkHttp(urlA, urlB);
      result.seo = await checkSeo(urlA, urlB);
      result.content = await checkContent(urlA, urlB);

      const diffStatus: DiffStatus = calcDiffStatus(result);
      updatePageResult(page.id, diffStatus, result);
    } catch (err) {
      updatePageResult(page.id, 'error', { error: err instanceof Error ? err.message : String(err) });
    }

    completed++;
    const stats = getSessionStats(sessionId);
    const overallProgress = stats.total_pages > 0
      ? Math.round((stats.scanned_pages / stats.total_pages) * 100)
      : 0;
    updateSessionScanStatus(sessionId, 'running', overallProgress);

    emit({
      type: 'batch_progress',
      current: completed,
      total: batchTotal,
      path: page.path,
      status: 'done',
      data: { scanned: stats.scanned_pages, totalPages: stats.total_pages },
    });
  };

  // Concurrency pool
  const executing = new Set<Promise<void>>();
  for (const page of batchPages) {
    if (signal.aborted) break;
    const p = processPage(page).then(() => { executing.delete(p); });
    executing.add(p);
    if (executing.size >= CONCURRENCY) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);

  if (!signal.aborted) {
    // Check if more pending pages remain
    const remaining = getPendingPages(sessionId, 1);
    const hasMore = remaining.length > 0;

    if (!hasMore) {
      updateSessionScanStatus(sessionId, 'done', 100);
    } else {
      // Back to pending so the status badge shows correctly
      updateSessionScanStatus(sessionId, 'pending');
    }

    emit({
      type: 'batch_complete',
      batchIndex: 0,
      results: [],
      hasMore,
      nextStart: 0, // unused — SQLite tracks state
    });
  } else {
    updateSessionScanStatus(sessionId, 'pending');
  }
});

function calcDiffStatus(result: DiffResult): DiffStatus {
  const CRITICAL_SEO = new Set(['title', 'description']);

  const httpFail = result.http?.items.some((i) => !i.match && i.name !== 'TTFB') ?? false;
  const seoFail = result.seo?.items.some((i) => !i.match && CRITICAL_SEO.has(i.name)) ?? false;
  const contentFail = result.content
    ? (result.content.text.similarity < 50 ||
       changeRatio(result.content.links.added.length, result.content.links.removed.length, result.content.links.countA) > 0.2 ||
       changeRatio(result.content.images.added.length, result.content.images.removed.length, result.content.images.countA) > 0.2)
    : false;

  if (httpFail || seoFail || contentFail) return 'fail';

  const contentWarn = result.content
    ? (result.content.text.similarity < 80 ||
       result.content.links.added.length > 0 || result.content.links.removed.length > 0 ||
       result.content.images.added.length > 0 || result.content.images.removed.length > 0)
    : false;

  return contentWarn ? 'warn' : 'pass';
}

function changeRatio(added: number, removed: number, total: number): number {
  if (total === 0) return 0;
  return (added + removed) / total;
}

export function startScan(sessionId: number, batchSize: number): string {
  return taskManager.createTask(SCAN_TOOL_ID, { sessionId, batchSize });
}
