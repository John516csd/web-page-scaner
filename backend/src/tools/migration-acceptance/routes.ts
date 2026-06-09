import type { FastifyInstance } from 'fastify';
import { taskManager } from '../../shared/task-manager.js';
import { sendSlackMessage } from '../../shared/slack.js';
import { acceptanceStore } from './db.js';
import { runAcceptance, runAcceptanceWorkbench, type WorkbenchRunResult } from './runner.js';
import type {
  AcceptanceRequest,
  AcceptanceResult,
  AcceptanceRunRequest,
  AcceptanceSessionDetail,
  CreateAcceptanceSessionInput,
  CreateDefectInput,
  UpsertEvidenceInput,
  UpsertSignoffInput,
} from './types.js';

const TOOL_ID = 'migration-acceptance';

type TaskPayload =
  | ({ mode: 'legacy' } & AcceptanceRequest)
  | ({ mode: 'workbench' } & AcceptanceRunRequest);

export function registerRoutes(fastify: FastifyInstance) {
  taskManager.registerHandler(TOOL_ID, async (_taskId, payload, emit, signal) => {
    const taskPayload = payload as TaskPayload;
    const result = taskPayload.mode === 'legacy'
      ? await runAcceptance(taskPayload, (event) => {
        if (!signal.aborted) emit(event as unknown as Parameters<typeof emit>[0]);
      })
      : await runAcceptanceWorkbench(taskPayload, (event) => {
        if (!signal.aborted) emit(event as unknown as Parameters<typeof emit>[0]);
      });

    if (signal.aborted) return;

    emit({ type: 'complete', result });
    if (taskPayload.notifySlack && process.env.SLACK_WEBHOOK_URL) {
      try {
        await sendSlackMessage(
          process.env.SLACK_WEBHOOK_URL,
          formatSlackReport(result) as unknown as Parameters<typeof sendSlackMessage>[1]
        );
        emit({ type: 'slack_sent', message: 'Slack notification sent' });
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to send Migration Acceptance Slack notification');
      }
    }
  });

  fastify.post<{ Body: CreateAcceptanceSessionInput }>('/sessions', async (request, reply) => {
    const body = request.body;
    if (!body.name || !body.env || !body.baseUrl) {
      return reply.status(400).send({ error: 'name, env and baseUrl are required' });
    }
    if (body.env !== 'test' && body.env !== 'production') {
      return reply.status(400).send({ error: 'env must be "test" or "production"' });
    }

    const session = acceptanceStore.createSession(body);
    return acceptanceStore.getSessionDetail(session.id);
  });

  fastify.get('/sessions', async () => {
    return acceptanceStore.listSessions();
  });

  fastify.get<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    const id = parseId(request.params.id);
    const detail = acceptanceStore.getSessionDetail(id);
    if (!detail) return reply.status(404).send({ error: 'Session not found' });
    return detail;
  });

  fastify.post<{ Params: { id: string }; Body: AcceptanceRunRequest }>('/sessions/:id/run', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!acceptanceStore.getSession(id)) return reply.status(404).send({ error: 'Session not found' });
    const taskId = taskManager.createTask(TOOL_ID, {
      ...request.body,
      mode: 'workbench',
      sessionId: id,
    } satisfies TaskPayload);
    return { taskId };
  });

  fastify.get<{ Params: { id: string; runId: string } }>('/sessions/:id/runs/:runId', async (request, reply) => {
    const sessionId = parseId(request.params.id);
    const runId = parseId(request.params.runId);
    const detail = acceptanceStore.getSessionDetail(sessionId);
    if (!detail) return reply.status(404).send({ error: 'Session not found' });
    const run = detail.runs.find((entry) => entry.id === runId);
    if (!run) return reply.status(404).send({ error: 'Run not found' });
    return {
      run,
      sections: acceptanceStore.listSectionsForRun(runId),
    };
  });

  fastify.patch<{ Params: { id: string; itemId: string }; Body: UpsertEvidenceInput }>(
    '/sessions/:id/evidence/:itemId',
    async (request, reply) => {
      const sessionId = parseId(request.params.id);
      if (!acceptanceStore.getSession(sessionId)) return reply.status(404).send({ error: 'Session not found' });
      const evidence = acceptanceStore.upsertEvidence(sessionId, {
        ...request.body,
        moduleId: request.body.moduleId || request.params.itemId,
        name: request.body.name || request.params.itemId,
      });
      return evidence;
    }
  );

  fastify.patch<{ Params: { id: string; moduleId: string }; Body: UpsertSignoffInput }>(
    '/sessions/:id/signoff/:moduleId',
    async (request, reply) => {
      const sessionId = parseId(request.params.id);
      if (!acceptanceStore.getSession(sessionId)) return reply.status(404).send({ error: 'Session not found' });
      const signoff = acceptanceStore.upsertSignoff(sessionId, {
        ...request.body,
        moduleId: request.body.moduleId || request.params.moduleId,
      });
      return signoff;
    }
  );

  fastify.post<{ Params: { id: string }; Body: CreateDefectInput }>('/sessions/:id/defects', async (request, reply) => {
    const sessionId = parseId(request.params.id);
    if (!acceptanceStore.getSession(sessionId)) return reply.status(404).send({ error: 'Session not found' });
    if (!request.body.title || !request.body.severity) {
      return reply.status(400).send({ error: 'title and severity are required' });
    }
    return acceptanceStore.createDefect(sessionId, request.body);
  });

  fastify.patch<{ Params: { id: string; defectId: string }; Body: Partial<CreateDefectInput> }>(
    '/sessions/:id/defects/:defectId',
    async (request, reply) => {
      const sessionId = parseId(request.params.id);
      const defectId = parseId(request.params.defectId);
      const defect = acceptanceStore.updateDefect(sessionId, defectId, request.body);
      if (!defect) return reply.status(404).send({ error: 'Defect not found' });
      return defect;
    }
  );

  fastify.get<{ Params: { id: string }; Querystring: { format?: 'json' | 'html' | 'md' } }>(
    '/sessions/:id/report',
    async (request, reply) => {
      const sessionId = parseId(request.params.id);
      const detail = acceptanceStore.getSessionDetail(sessionId);
      if (!detail) return reply.status(404).send({ error: 'Session not found' });

      const format = request.query.format || 'json';
      if (format === 'html') {
        return reply.type('text/html; charset=utf-8').send(formatHtmlReport(detail));
      }
      if (format === 'md') {
        return reply.type('text/markdown; charset=utf-8').send(formatMarkdownReport(detail));
      }
      return formatJsonReport(detail);
    }
  );

  fastify.post<{ Params: { id: string }; Body: AcceptanceRunRequest }>('/sessions/:id/observe', async (request, reply) => {
    const id = parseId(request.params.id);
    if (!acceptanceStore.getSession(id)) return reply.status(404).send({ error: 'Session not found' });
    const taskId = taskManager.createTask(TOOL_ID, {
      ...request.body,
      mode: 'workbench',
      sessionId: id,
      stages: ['T4'],
      suites: request.body.suites?.length ? request.body.suites : ['post-launch', 'smoke', 'assets'],
    } satisfies TaskPayload);
    return { taskId };
  });

  fastify.post('/run', async (request, reply) => {
    const body = request.body as AcceptanceRequest;
    if (!body.env || !['test', 'production'].includes(body.env)) {
      return reply.status(400).send({ error: 'env must be "test" or "production"' });
    }
    if (!body.baseUrl) {
      return reply.status(400).send({ error: 'baseUrl is required' });
    }

    const taskId = taskManager.createTask(TOOL_ID, { ...body, mode: 'legacy' } satisfies TaskPayload);
    return { taskId };
  });
}

function parseId(value: string): number {
  const id = Number.parseInt(value, 10);
  if (!Number.isFinite(id)) throw new Error(`Invalid id: ${value}`);
  return id;
}

function formatSlackReport(result: AcceptanceResult | WorkbenchRunResult) {
  const summary = result.summary;
  const sections = result.sections;
  const goNoGo = 'goNoGo' in result ? result.goNoGo : undefined;
  const statusEmoji = goNoGo?.decision === 'go' || summary.failed === 0 ? '✅' : '⚠️';
  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Migration Acceptance 验收工作台报告', emoji: true },
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Go/No-Go:*\n${statusEmoji} ${goNoGo?.decision?.toUpperCase() || 'UNKNOWN'}` },
        { type: 'mrkdwn', text: `*通过:*\n${summary.passed}/${summary.total}` },
        { type: 'mrkdwn', text: `*失败:*\n${summary.failed}` },
        { type: 'mrkdwn', text: `*警告:*\n${summary.warned}` },
      ],
    },
  ];

  const failedItems = sections.flatMap((section) =>
    section.items
      .filter((item) => item.status === 'fail' || item.status === 'blocked')
      .slice(0, 5)
      .map((item) => ({ section: section.name, item }))
  );

  if (failedItems.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*阻塞/失败项（最多显示 ${failedItems.length} 条）:*` },
    });
    for (const failure of failedItems) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${failure.section} — ${failure.item.name}*\nURL: \`${failure.item.url || '-'}\`\n原因: ${failure.item.failureReason || failure.item.actual}`,
        },
      });
    }
  }

  return blocks;
}

function formatJsonReport(detail: AcceptanceSessionDetail) {
  return {
    session: detail.session,
    runs: detail.runs,
    sections: detail.sections,
    items: detail.items,
    goNoGo: detail.goNoGo,
  };
}

export function formatMarkdownReport(detail: AcceptanceSessionDetail): string {
  const lines = [
    `# Migration Acceptance Report`,
    ``,
    `- Session: ${detail.session.name}`,
    `- Env: ${detail.session.env}`,
    `- Next URL: ${detail.session.baseUrl}`,
    `- Gatsby URL: ${detail.session.gatsbyUrl}`,
    `- Go/No-Go: ${detail.goNoGo.decision.toUpperCase()}`,
    ``,
    `## Blockers`,
    ...(detail.goNoGo.blockers.length
      ? detail.goNoGo.blockers.map((blocker) => `- [${blocker.type}] ${blocker.severity || ''} ${blocker.title} ${blocker.detail || ''}`.trim())
      : ['- None']),
    ``,
    `## Automated Sections`,
  ];

  for (const section of detail.sections) {
    lines.push(`- ${section.stage || ''} ${section.name}: ${section.status.toUpperCase()} (${section.passed}/${section.total}, failed ${section.failed}, warned ${section.warned})`);
  }

  return lines.join('\n');
}

function formatHtmlReport(detail: AcceptanceSessionDetail): string {
  const sections = detail.sections.map((section) => `
    <tr>
      <td>${escapeHtml(section.stage || '')}</td>
      <td>${escapeHtml(section.name)}</td>
      <td>${escapeHtml(section.status)}</td>
      <td>${section.passed}/${section.total}</td>
      <td>${section.failed}</td>
      <td>${section.warned}</td>
    </tr>
  `).join('');
  const blockers = detail.goNoGo.blockers.map((blocker) => `
    <li><strong>${escapeHtml(blocker.type)}</strong> ${escapeHtml(blocker.severity || '')} ${escapeHtml(blocker.title)} ${escapeHtml(blocker.detail || '')}</li>
  `).join('') || '<li>None</li>';

  return `<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <title>Migration Acceptance Report</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px auto; max-width: 1180px; color: #111827; }
    h1, h2 { margin: 0 0 16px; }
    .meta { color: #6b7280; line-height: 1.7; }
    .decision { display: inline-block; padding: 6px 10px; border-radius: 6px; background: ${detail.goNoGo.decision === 'go' ? '#dcfce7' : '#fee2e2'}; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; font-size: 14px; }
    th { background: #f9fafb; }
  </style>
</head>
<body>
  <h1>Migration Acceptance Report</h1>
  <p class="meta">
    Session: ${escapeHtml(detail.session.name)}<br />
    Env: ${escapeHtml(detail.session.env)}<br />
    Next URL: ${escapeHtml(detail.session.baseUrl)}<br />
    Gatsby URL: ${escapeHtml(detail.session.gatsbyUrl)}
  </p>
  <p class="decision">Go/No-Go: ${escapeHtml(detail.goNoGo.decision.toUpperCase())}</p>
  <h2>Blockers</h2>
  <ul>${blockers}</ul>
  <h2>Automated Sections</h2>
  <table>
    <thead><tr><th>Stage</th><th>Suite</th><th>Status</th><th>Passed</th><th>Failed</th><th>Warned</th></tr></thead>
    <tbody>${sections}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
