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
          emit({
            type: 'progress',
            step: `switch-${testCase.id}`,
            status: 'running',
            message: `Switching proxy to ${testCase.country}...`,
            data: { index: i, total: testCases.length },
          });

          const nodeName = await switchToCountry(testCase.country);
          if (nodeName) {
            usedNode = nodeName;
            lastCountry = testCase.country;
          } else {
            usedNode = undefined;
          }
        } else if (canSwitch && testCase.country) {
          usedNode = lastCountry ? `(cached: ${lastCountry})` : undefined;
        }

        emit({
          type: 'progress',
          step: `test-${testCase.id}`,
          status: 'running',
          message: `Running: ${testCase.name}${usedNode ? ` [${usedNode}]` : ''}`,
          data: { index: i, total: testCases.length },
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

  fastify.post('/run', async (request) => {
    const body = request.body as RunTestsRequest;

    if (!body.testCases || !Array.isArray(body.testCases) || body.testCases.length === 0) {
      throw { statusCode: 400, message: 'testCases array is required and must not be empty' };
    }

    const taskId = taskManager.createTask(TOOL_ID, body);
    return { taskId };
  });
}
