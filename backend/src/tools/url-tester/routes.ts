import type { FastifyInstance } from 'fastify';
import net from 'node:net';
import { taskManager } from '../../shared/task-manager.js';
import { executeTest } from './test-executor.js';
import { getCurrentNode, switchToCountry, switchToNode, isAvailable, findAllNodesForCountry, healthCheckNode } from './node-switcher.js';
import { sendSlackMessage, formatTestReport } from '../../shared/slack.js';
import { getSchedule, getAllSchedules, updateSchedule, runScheduleNow } from './scheduler.js';
import { collectionStore } from './collections.js';
import type { RunTestsRequest, UrlTestCase } from './types.js';

interface KnownProxy {
  port: number;
  name: string;
  protocol: 'http' | 'socks5';
}

const KNOWN_PROXIES: KnownProxy[] = [
  { port: 7890, name: 'Clash / Mihomo', protocol: 'http' },
  { port: 7891, name: 'Clash SOCKS5', protocol: 'socks5' },
  { port: 9674, name: 'Biuuu', protocol: 'http' },
  { port: 1087, name: 'ClashX Pro', protocol: 'http' },
  { port: 1080, name: 'SOCKS5 通用', protocol: 'socks5' },
  { port: 8118, name: 'Privoxy', protocol: 'http' },
  { port: 8080, name: 'HTTP 代理', protocol: 'http' },
  { port: 6152, name: 'Surge', protocol: 'http' },
  { port: 8888, name: 'Charles', protocol: 'http' },
  { port: 9090, name: 'Mihomo API', protocol: 'http' },
  { port: 1088, name: 'V2RayU', protocol: 'http' },
  { port: 10809, name: 'V2RayN', protocol: 'http' },
  { port: 10808, name: 'V2RayN SOCKS5', protocol: 'socks5' },
  { port: 2080, name: 'Shadowrocket', protocol: 'http' },
  { port: 20171, name: 'Quantumult X', protocol: 'http' },
];

function checkPort(port: number, timeout = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}

const TOOL_ID = 'url-tester';

export function registerRoutes(fastify: FastifyInstance) {
  taskManager.registerHandler(TOOL_ID, async (_taskId, payload, emit, signal) => {
    const { testCases, proxy, notifySlack, collectionName } = payload as RunTestsRequest;
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
        let vpnFailed = false;
        const triedNodes: string[] = [];

        // 如果测试用例需要 VPN 但 VPN 不可用
        if (testCase.country && !canSwitch) {
          vpnFailed = true;
          emit({
            type: 'progress',
            step: `vpn-check-${testCase.id}`,
            status: 'error',
            message: `⚠️ ${testCase.name} 需要 ${testCase.country} VPN，但 VPN 未启用或不可用`,
            data: { index: i, total: testCases.length },
          });
        } else if (canSwitch && testCase.country && testCase.country !== lastCountry) {
          emit({
            type: 'progress',
            step: `vpn-switch-${testCase.id}`,
            status: 'running',
            message: `正在为 ${testCase.name} 切换到 ${testCase.country} VPN...`,
            data: { index: i, total: testCases.length },
          });

          const allNodes = await findAllNodesForCountry(testCase.country);
          
          if (allNodes.length === 0) {
            vpnFailed = true;
            emit({
              type: 'progress',
              step: `vpn-switch-${testCase.id}`,
              status: 'error',
              message: `未找到 ${testCase.country} 的 VPN 节点`,
              data: { index: i, total: testCases.length },
            });
          } else {
            let workingNode: string | null = null;

            for (const node of allNodes) {
              emit({
                type: 'progress',
                step: `vpn-health-${testCase.id}`,
                status: 'running',
                message: `正在测试 ${node}...`,
                data: { index: i, total: testCases.length },
              });

              await switchToNode(node);
              const healthy = await healthCheckNode(proxy!);
              triedNodes.push(node);

              if (healthy) {
                workingNode = node;
                emit({
                  type: 'progress',
                  step: `vpn-health-${testCase.id}`,
                  status: 'done',
                  message: `✓ 已连接到 ${node}`,
                  data: { index: i, total: testCases.length },
                });
                break;
              } else {
                emit({
                  type: 'progress',
                  step: `vpn-health-${testCase.id}`,
                  status: 'error',
                  message: `✗ ${node} 不可用，尝试下一个...`,
                  data: { index: i, total: testCases.length },
                });
              }
            }

            if (!workingNode) {
              vpnFailed = true;
              emit({
                type: 'progress',
                step: `vpn-switch-${testCase.id}`,
                status: 'error',
                message: `所有 ${testCase.country} VPN 节点都不可用`,
                data: { index: i, total: testCases.length },
              });
            } else {
              usedNode = workingNode;
              lastCountry = testCase.country;
            }
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

        // 执行测试，即使 VPN 失败也继续
        const result = await executeTest(testCase, proxy);
        result.usedNode = usedNode;
        
        // 如果需要 VPN 但连接失败，在结果中添加警告
        if (vpnFailed && testCase.country) {
          result.vpnWarning = `⚠️ 该测试需要 ${testCase.country} VPN，但连接失败${triedNodes.length > 0 ? ` (尝试了 ${triedNodes.join(', ')})` : ''}。测试结果可能不准确。`;
          result.triedNodes = triedNodes.length > 0 ? triedNodes : undefined;
        }

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
      const summary = {
        total: results.length,
        passed: results.filter((r) => r.passed).length,
        failed: results.filter((r) => !r.passed).length,
        duration: totalDuration,
      };

      emit({
        type: 'complete',
        result: {
          results,
          summary,
        },
      });

      if (notifySlack && process.env.SLACK_WEBHOOK_URL) {
        try {
          const failures = results
            .filter((r) => !r.passed)
            .map((r) => ({
              name: r.testCase.name,
              url: r.testCase.url,
              expectedStatus: r.testCase.expectedStatus,
              actualStatus: r.actualStatus,
              expectedRedirectUrl: r.testCase.expectedRedirectUrl,
              actualRedirectUrl: r.actualRedirectUrl,
              failureReason: r.failureReason,
            }));

          const title = collectionName ? `URL Tester — ${collectionName}` : 'URL Tester';
          const blocks = formatTestReport(title, summary, failures);
          await sendSlackMessage(process.env.SLACK_WEBHOOK_URL, blocks);

          emit({
            type: 'slack_sent',
            message: 'Slack notification sent',
          });
        } catch (error) {
          fastify.log.error({ err: error }, 'Failed to send Slack notification');
        }
      }
    }
  });

  fastify.get('/detect-proxies', async () => {
    const results = await Promise.all(
      KNOWN_PROXIES.map(async (p) => {
        const open = await checkPort(p.port);
        return open ? p : null;
      })
    );
    return results
      .filter((r): r is KnownProxy => r !== null)
      .map((p) => ({
        url: `${p.protocol === 'socks5' ? 'socks5' : 'http'}://127.0.0.1:${p.port}`,
        name: p.name,
        port: p.port,
        protocol: p.protocol,
      }));
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

  // --- Collection CRUD ---

  fastify.get('/collections', async () => {
    return collectionStore.getAll();
  });

  fastify.get('/collections/:id', async (request) => {
    const { id } = request.params as { id: string };
    const collection = collectionStore.getById(id);
    if (!collection) throw { statusCode: 404, message: `Collection ${id} not found` };
    return collection;
  });

  fastify.post('/collections', async (request) => {
    const body = request.body as { name: string; description?: string; testCases?: UrlTestCase[] };
    if (!body.name) throw { statusCode: 400, message: 'name is required' };
    return await collectionStore.create({
      name: body.name,
      description: body.description,
      testCases: body.testCases || [],
    });
  });

  fastify.put('/collections/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; description?: string; testCases?: UrlTestCase[] };
    try {
      return await collectionStore.update(id, body);
    } catch {
      throw { statusCode: 404, message: `Collection ${id} not found` };
    }
  });

  fastify.delete('/collections/:id', async (request) => {
    const { id } = request.params as { id: string };
    try {
      await collectionStore.remove(id);
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
      proxy?: string;
      notifySlack?: boolean;
    };

    if (!body.cron) {
      throw { statusCode: 400, message: 'cron expression is required' };
    }

    const collection = collectionStore.getById(id);
    if (!collection) {
      throw { statusCode: 404, message: `Collection ${id} not found` };
    }

    const schedule = await updateSchedule(id, body.cron, body.enabled, {
      proxy: body.proxy,
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
