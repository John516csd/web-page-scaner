import type { FastifyInstance } from 'fastify';
import { taskManager } from '../../shared/task-manager.js';
import { executeTest } from './test-executor.js';
import { getCurrentNode, switchToCountry, switchToNode, isAvailable } from './node-switcher.js';
import type { RunTestsRequest } from './types.js';

const TOOL_ID = 'redirect-tester';

export function registerRoutes(fastify: FastifyInstance) {
  taskManager.registerHandler(TOOL_ID, async (_taskId, payload, emit, signal) => {
    const { testCases, proxy } = payload as RunTestsRequest;
    const results = [];
    const startTime = Date.now();

    const canSwitch = proxy && await isAvailable();
    const originalNode = canSwitch ? await getCurrentNode() : '';
    let lastCountry: string | undefined;

    try {
      for (let i = 0; i < testCases.length; i++) {
        if (signal.aborted) break;

        const testCase = testCases[i];
        let usedNode: string | undefined;

        if (canSwitch && testCase.country && testCase.country !== lastCountry) {
          const nodeName = await switchToCountry(testCase.country);
          if (nodeName) {
            usedNode = nodeName;
            lastCountry = testCase.country;
          }
        } else if (canSwitch && testCase.country && lastCountry) {
          usedNode = lastCountry;
        }

        emit({
          type: 'progress',
          step: `test-${testCase.id}`,
          status: 'running',
          message: testCase.name,
          data: { index: i, total: testCases.length, usedNode },
        });

        const result = await executeTest(testCase, proxy);
        result.usedNode = usedNode;

        emit({
          type: 'progress',
          step: `test-${testCase.id}`,
          status: result.passed ? 'done' : 'error',
          message: result.passed ? `✓ ${testCase.name}` : `✗ ${testCase.name}: ${result.failureReason}`,
          data: result,
        });

        results.push(result);
      }
    } finally {
      if (canSwitch && originalNode && lastCountry) {
        try {
          await switchToNode(originalNode);
        } catch {
          // best effort restore
        }
      }
    }

    if (!signal.aborted) {
      const totalDuration = Date.now() - startTime;
      emit({
        type: 'complete',
        result: {
          results,
          summary: {
            total: results.length,
            passed: results.filter((r) => r.passed).length,
            failed: results.filter((r) => !r.passed).length,
            duration: totalDuration,
          },
        },
      });
    }
  });

  fastify.post('/check-proxy', async (request) => {
    const { proxy } = request.body as { proxy?: string };
    if (!proxy) return { ok: true, mode: 'direct' as const };

    try {
      const { fetch: undiciFetch } = await import('undici');
      const { ProxyAgent } = await import('undici');
      const res = await undiciFetch('https://ipinfo.io/json', {
        dispatcher: new ProxyAgent(proxy),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json() as { country?: string; city?: string; ip?: string };
      const mihomoUp = await isAvailable();
      return {
        ok: true,
        mode: 'proxy' as const,
        ip: data.ip,
        country: data.country,
        city: data.city,
        autoSwitch: mihomoUp,
      };
    } catch {
      return { ok: false, mode: 'proxy' as const, error: '代理连接失败，请检查 VPN 是否已开启' };
    }
  });

  fastify.post('/run', async (request) => {
    const body = request.body as RunTestsRequest;

    if (!body.testCases || !Array.isArray(body.testCases) || body.testCases.length === 0) {
      throw { statusCode: 400, message: 'testCases array is required and must not be empty' };
    }

    const taskId = taskManager.createTask(TOOL_ID, body);
    return { taskId };
  });
}
