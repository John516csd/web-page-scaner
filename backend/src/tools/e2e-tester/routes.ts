import type { FastifyInstance } from 'fastify';
import { taskManager } from '../../shared/task-manager.js';
import { executeE2ETest } from './test-executor.js';
import { sendSlackMessage } from '../../shared/slack.js';
import { getSchedule, getAllSchedules, updateSchedule, runScheduleNow } from './scheduler.js';
import { e2eCollectionStore } from './collections.js';
import { formatE2ESlackReport } from './slack-report.js';
import type { RunE2ERequest, E2ETestCase, E2ETestResult } from './types.js';

const TOOL_ID = 'e2e-tester';

export function registerRoutes(fastify: FastifyInstance) {
  taskManager.registerHandler(TOOL_ID, async (_taskId, payload, emit, signal) => {
    const { testCases, notifySlack, collectionName } = payload as RunE2ERequest;
    const results: E2ETestResult[] = [];
    const startTime = Date.now();

    for (let i = 0; i < testCases.length; i++) {
      if (signal.aborted) break;

      const testCase = testCases[i];

      emit({
        type: 'progress',
        step: `test-${testCase.id}`,
        status: 'running',
        message: testCase.name,
        data: { index: i, total: testCases.length },
      });

      const result = await executeE2ETest(testCase);

      emit({
        type: 'progress',
        step: `test-${testCase.id}`,
        status: result.passed ? 'done' : 'error',
        message: result.passed ? `✓ ${testCase.name}` : `✗ ${testCase.name}: ${result.error}`,
        data: result,
      });

      results.push(result);
    }

    if (!signal.aborted) {
      const totalDuration = Date.now() - startTime;
      const summary = {
        total: results.length,
        passed: results.filter((r) => r.passed).length,
        failed: results.filter((r) => !r.passed).length,
        duration: totalDuration,
      };

      emit({ type: 'complete', result: { results, summary } });

      if (notifySlack && process.env.SLACK_WEBHOOK_URL) {
        try {
          const title = collectionName ? `E2E Tester — ${collectionName}` : 'E2E Tester';
          const failures = results.filter((r) => !r.passed);
          const blocks = formatE2ESlackReport(title, summary, failures, process.env.SLACK_FAILURE_MENTION);
          await sendSlackMessage(process.env.SLACK_WEBHOOK_URL, blocks as any);

          emit({ type: 'slack_sent', message: 'Slack notification sent' });
        } catch (error) {
          fastify.log.error({ err: error }, 'Failed to send E2E Slack notification');
        }
      }
    }
  });

  // --- Run ---

  fastify.post('/run', async (request) => {
    const body = request.body as RunE2ERequest;

    if (!body.testCases || !Array.isArray(body.testCases) || body.testCases.length === 0) {
      throw { statusCode: 400, message: 'testCases array is required and must not be empty' };
    }

    const taskId = taskManager.createTask(TOOL_ID, body);
    return { taskId };
  });

  // --- Collection CRUD ---

  fastify.get('/collections', async () => {
    return e2eCollectionStore.getAll();
  });

  fastify.get('/collections/:id', async (request) => {
    const { id } = request.params as { id: string };
    const collection = e2eCollectionStore.getById(id);
    if (!collection) throw { statusCode: 404, message: `Collection ${id} not found` };
    return collection;
  });

  fastify.post('/collections', async (request) => {
    const body = request.body as { name: string; description?: string; testCases?: E2ETestCase[] };
    if (!body.name) throw { statusCode: 400, message: 'name is required' };
    return await e2eCollectionStore.create({
      name: body.name,
      description: body.description,
      testCases: body.testCases || [],
    });
  });

  fastify.put('/collections/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; description?: string; testCases?: E2ETestCase[] };
    try {
      return await e2eCollectionStore.update(id, body);
    } catch {
      throw { statusCode: 404, message: `Collection ${id} not found` };
    }
  });

  fastify.delete('/collections/:id', async (request) => {
    const { id } = request.params as { id: string };
    try {
      await e2eCollectionStore.remove(id);
      return { ok: true };
    } catch {
      throw { statusCode: 404, message: `Collection ${id} not found` };
    }
  });

  // --- Schedules ---

  fastify.get('/schedules', async () => {
    return getAllSchedules();
  });

  fastify.get('/collections/:id/schedule', async (request) => {
    const { id } = request.params as { id: string };
    const schedule = getSchedule(id);
    return schedule || null;
  });

  fastify.put('/collections/:id/schedule', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      cron: string;
      enabled: boolean;
      notifySlack?: boolean;
    };

    if (!body.cron) {
      throw { statusCode: 400, message: 'cron expression is required' };
    }

    const collection = e2eCollectionStore.getById(id);
    if (!collection) {
      throw { statusCode: 404, message: `Collection ${id} not found` };
    }

    const schedule = await updateSchedule(id, body.cron, body.enabled, {
      notifySlack: body.notifySlack,
    });

    return schedule;
  });

  fastify.post('/collections/:id/schedule/run', async (request) => {
    const { id } = request.params as { id: string };
    try {
      const result = await runScheduleNow(id);
      return result;
    } catch (error) {
      throw { statusCode: 400, message: (error as Error).message };
    }
  });
}
