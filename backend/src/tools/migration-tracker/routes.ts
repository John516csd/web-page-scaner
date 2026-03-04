import type { FastifyInstance } from 'fastify';
import {
  createSession,
  listSessions,
  getSession,
  getSessionStats,
  listPages,
  listChanges,
  bulkInsertChanges,
  updateChangeStatus,
  getChange,
  deleteChange,
  deleteAllChanges,
} from './db.js';
import { startScan } from './diff-runner.js';
import { startAnalysis } from './ai-analyzer.js';
import type {
  CreateSessionRequest,
  PatchChangeRequest,
  DiffStatus,
  ChangeStatus,
} from './types.js';

// Minimal CSV parser — handles quoted fields
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const cells: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cells.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

function generateHtmlReport(session: ReturnType<typeof getSession>, stats: ReturnType<typeof getSessionStats>, changes: ReturnType<typeof listChanges>): string {
  const changeRows = changes.map((c) => {
    const pages = c.pages_affected ? (JSON.parse(c.pages_affected) as string[]) : [];
    const statusColor: Record<string, string> = {
      verified: '#22c55e', failed: '#ef4444', skipped: '#94a3b8', pending: '#f59e0b',
    };
    return `
      <tr>
        <td><a href="${c.pr_url}" target="_blank">${c.pr_url.split('/').pop() ?? c.pr_url}</a></td>
        <td>${c.description}</td>
        <td style="color:${statusColor[c.status] ?? '#000'}">${c.status}</td>
        <td>${c.confidence_score ?? '-'}</td>
        <td>${pages.join(', ') || '-'}</td>
        <td>${c.ai_reasoning ?? '-'}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>迁移验收报告 - ${session!.name}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1, h2 { color: #1e293b; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; text-align: center; }
    .stat-value { font-size: 2rem; font-weight: bold; color: #0f172a; }
    .stat-label { color: #64748b; font-size: 0.875rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; font-size: 0.875rem; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:hover { background: #f8fafc; }
  </style>
</head>
<body>
  <h1>迁移验收报告</h1>
  <p><strong>会话名称：</strong>${session!.name}</p>
  <p><strong>Gatsby URL：</strong>${session!.gatsby_base_url}</p>
  <p><strong>Next.js URL：</strong>${session!.nextjs_base_url}</p>
  <p><strong>创建时间：</strong>${session!.created_at}</p>

  <h2>页面扫描统计</h2>
  <div class="stats">
    <div class="stat"><div class="stat-value">${stats.total_pages}</div><div class="stat-label">总页面数</div></div>
    <div class="stat"><div class="stat-value">${stats.scanned_pages}</div><div class="stat-label">已扫描</div></div>
    <div class="stat"><div class="stat-value" style="color:#22c55e">${stats.pass_pages}</div><div class="stat-label">通过</div></div>
    <div class="stat"><div class="stat-value" style="color:#f59e0b">${stats.warn_pages}</div><div class="stat-label">警告</div></div>
    <div class="stat"><div class="stat-value" style="color:#ef4444">${stats.fail_pages}</div><div class="stat-label">失败</div></div>
  </div>

  <h2>变更记录统计</h2>
  <div class="stats">
    <div class="stat"><div class="stat-value">${stats.total_changes}</div><div class="stat-label">总变更数</div></div>
    <div class="stat"><div class="stat-value" style="color:#22c55e">${stats.verified_changes}</div><div class="stat-label">已验证</div></div>
    <div class="stat"><div class="stat-value" style="color:#ef4444">${stats.failed_changes}</div><div class="stat-label">验证失败</div></div>
    <div class="stat"><div class="stat-value" style="color:#94a3b8">${stats.skipped_changes}</div><div class="stat-label">已跳过</div></div>
    <div class="stat"><div class="stat-value" style="color:#f59e0b">${stats.pending_changes}</div><div class="stat-label">待处理</div></div>
  </div>

  <h2>变更记录详情</h2>
  <table>
    <thead>
      <tr>
        <th>PR</th><th>描述</th><th>状态</th><th>置信度</th><th>关联页面</th><th>AI 推断</th>
      </tr>
    </thead>
    <tbody>${changeRows}</tbody>
  </table>
</body>
</html>`;
}

export function registerRoutes(fastify: FastifyInstance) {
  // Create session
  fastify.post<{ Body: CreateSessionRequest }>('/sessions', async (req, reply) => {
    const { name, gatsby_base_url, nextjs_base_url, sitemap_url } = req.body;
    if (!name || !gatsby_base_url || !nextjs_base_url || !sitemap_url) {
      return reply.status(400).send({ error: 'name, gatsby_base_url, nextjs_base_url, sitemap_url are required' });
    }
    return createSession(name, gatsby_base_url, nextjs_base_url, sitemap_url);
  });

  // List sessions
  fastify.get('/sessions', async () => {
    return listSessions();
  });

  // Get session + stats
  fastify.get<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
    const id = parseInt(req.params.id);
    const session = getSession(id);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    const stats = getSessionStats(id);
    return { ...session, stats };
  });

  // Start scan (one batch)
  fastify.post<{ Params: { id: string }; Body: { batchSize?: number } }>(
    '/sessions/:id/scan',
    async (req, reply) => {
      const id = parseInt(req.params.id);
      const session = getSession(id);
      if (!session) return reply.status(404).send({ error: 'Session not found' });
      const batchSize = Math.min(Math.max(1, req.body?.batchSize ?? 50), 500);
      const taskId = startScan(id, batchSize);
      return { taskId };
    }
  );

  // List pages (paginated)
  fastify.get<{
    Params: { id: string };
    Querystring: { limit?: string; offset?: string; diffStatus?: string; path?: string };
  }>('/sessions/:id/pages', async (req, reply) => {
    const id = parseInt(req.params.id);
    const session = getSession(id);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const limit = Math.min(parseInt(req.query.limit ?? '50'), 200);
    const offset = parseInt(req.query.offset ?? '0');
    const diffStatus = req.query.diffStatus as DiffStatus | undefined;
    const pathFilter = req.query.path;

    const { rows, total } = listPages(id, { limit, offset, diffStatus, pathFilter });
    return { rows, total, limit, offset };
  });

  // Import changes from CSV
  fastify.post<{ Params: { id: string }; Body: { csv: string } }>(
    '/sessions/:id/changes/import',
    async (req, reply) => {
      const id = parseInt(req.params.id);
      const session = getSession(id);
      if (!session) return reply.status(404).send({ error: 'Session not found' });

      const { csv } = req.body;
      if (!csv) return reply.status(400).send({ error: 'csv is required' });

      const rows = parseCsv(csv);
      if (rows.length === 0) return reply.status(400).send({ error: 'Empty CSV' });

      const changes: { pr_url: string; description: string }[] = [];

      // Detect if first row is a header (no GitHub URL in any cell)
      const firstRow = rows[0];
      const hasHeader = !firstRow.some((cell) => cell.includes('github.com'));

      if (hasHeader) {
        // Map columns by header name
        const headers = firstRow.map((h) => h.toLowerCase().trim());

        // Find PR URL column: exact "pr_url" / "pr 链接" / contains "pr" or "url"
        const prCol = headers.findIndex((h) =>
          h === 'pr_url' || h === 'pr 链接' || h === 'pr链接' ||
          (h.includes('pr') && (h.includes('链接') || h.includes('url') || h.includes('link')))
        );

        // Find description columns: Features 内容, Bug 内容, description, 描述, 内容
        const descCols = headers.reduce<number[]>((acc, h, i) => {
          if (
            h.includes('内容') || h.includes('description') ||
            h.includes('描述') || h === 'desc' || h.includes('feature') || h.includes('bug')
          ) acc.push(i);
          return acc;
        }, []);

        // Type column for prefixing description
        const typeCol = headers.findIndex((h) => h === '类型' || h === 'type');

        if (prCol === -1) {
          return reply.status(400).send({ error: '找不到 PR 链接列，请确保表头包含 "PR 链接" 或 "pr_url"' });
        }

        for (const row of rows.slice(1)) {
          const pr_url = row[prCol]?.trim();
          if (!pr_url || !pr_url.includes('github.com')) continue;

          // Combine all description columns, skip empty ones
          const descParts = descCols
            .map((i) => row[i]?.trim())
            .filter(Boolean);

          // Prepend type if available
          const type = typeCol !== -1 ? row[typeCol]?.trim() : '';
          const description = [type, ...descParts].filter(Boolean).join('：');

          if (!description) continue;
          changes.push({ pr_url, description });
        }
      } else {
        // No header: treat col 0 as pr_url, col 1 as description
        for (const row of rows) {
          if (row.length < 2) continue;
          const [pr_url, description] = row;
          if (!pr_url || !description) continue;
          changes.push({ pr_url, description });
        }
      }

      if (changes.length === 0) {
        return reply.status(400).send({ error: 'No valid rows found in CSV' });
      }

      const count = bulkInsertChanges(id, changes);
      return { imported: count };
    }
  );

  // List changes
  fastify.get<{ Params: { id: string } }>('/sessions/:id/changes', async (req, reply) => {
    const id = parseInt(req.params.id);
    const session = getSession(id);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    return listChanges(id);
  });

  // Import changes from GitHub PR URLs
  fastify.post<{
    Params: { id: string };
    Body: { pr_urls: string[]; token?: string };
  }>('/sessions/:id/changes/import-github', async (req, reply) => {
    const id = parseInt(req.params.id);
    const session = getSession(id);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const { pr_urls, token } = req.body;
    if (!pr_urls?.length) return reply.status(400).send({ error: 'pr_urls is required' });

    const headers: Record<string, string> = {
      'User-Agent': 'WebPageScanner/1.0',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const changes: { pr_url: string; description: string }[] = [];
    const errors: { url: string; error: string }[] = [];

    for (const url of pr_urls) {
      // Parse https://github.com/{owner}/{repo}/pull/{number}
      const match = url.trim().match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
      if (!match) {
        errors.push({ url, error: 'URL 格式不正确，需为 github.com/{owner}/{repo}/pull/{number}' });
        continue;
      }
      const [, owner, repo, number] = match;
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;

      try {
        const res = await fetch(apiUrl, { headers });
        if (!res.ok) {
          errors.push({ url, error: `GitHub API ${res.status}: ${await res.text()}` });
          continue;
        }
        const pr = await res.json() as { html_url: string; title: string; body: string | null };
        const description = pr.body
          ? `${pr.title}\n\n${pr.body.slice(0, 500)}`
          : pr.title;
        changes.push({ pr_url: pr.html_url, description });
      } catch (err) {
        errors.push({ url, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const count = changes.length > 0 ? bulkInsertChanges(id, changes) : 0;
    return { imported: count, errors };
  });

  // Trigger AI analysis
  fastify.post<{ Params: { id: string } }>(
    '/sessions/:id/changes/analyze-all',
    async (req, reply) => {
      const id = parseInt(req.params.id);
      const session = getSession(id);
      if (!session) return reply.status(404).send({ error: 'Session not found' });
      const taskId = startAnalysis(id);
      return { taskId };
    }
  );

  // Patch change status
  fastify.patch<{
    Params: { id: string; changeId: string };
    Body: PatchChangeRequest;
  }>('/sessions/:id/changes/:changeId', async (req, reply) => {
    const sessionId = parseInt(req.params.id);
    const changeId = parseInt(req.params.changeId);
    const { status } = req.body;

    const validStatuses: ChangeStatus[] = ['pending', 'verified', 'failed', 'skipped'];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ error: 'Invalid status' });
    }

    const change = getChange(changeId);
    if (!change || change.session_id !== sessionId) {
      return reply.status(404).send({ error: 'Change not found' });
    }

    updateChangeStatus(changeId, status);
    return { ok: true };
  });

  // Delete all change records for a session
  fastify.delete<{ Params: { id: string } }>('/sessions/:id/changes', async (req, reply) => {
    const id = parseInt(req.params.id);
    const session = getSession(id);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    deleteAllChanges(id);
    return { ok: true };
  });

  // Delete change record
  fastify.delete<{ Params: { id: string; changeId: string } }>(
    '/sessions/:id/changes/:changeId',
    async (req, reply) => {
      const sessionId = parseInt(req.params.id);
      const changeId = parseInt(req.params.changeId);
      const change = getChange(changeId);
      if (!change || change.session_id !== sessionId) {
        return reply.status(404).send({ error: 'Change not found' });
      }
      deleteChange(changeId);
      return { ok: true };
    }
  );

  // Export report
  fastify.get<{
    Params: { id: string };
    Querystring: { format?: string };
  }>('/sessions/:id/report', async (req, reply) => {
    const id = parseInt(req.params.id);
    const session = getSession(id);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const stats = getSessionStats(id);
    const changes = listChanges(id);
    const format = req.query.format ?? 'json';

    if (format === 'html') {
      reply.header('Content-Type', 'text/html; charset=utf-8');
      return generateHtmlReport(session, stats, changes);
    }

    // JSON report
    return { session, stats, changes };
  });
}
