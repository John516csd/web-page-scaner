import { scheduler, type ScheduledJob } from '../../shared/scheduler.js';
import { executeE2ETest } from './test-executor.js';
import { sendSlackMessage } from '../../shared/slack.js';
import { e2eCollectionStore } from './collections.js';
import type { E2ETestResult } from './types.js';

const TOOL_ID = 'e2e-tester';

function getJobId(collectionId: string) {
  return `e2e-tester-${collectionId}`;
}

interface ScheduleConfig {
  [key: string]: unknown;
  collectionId?: string;
  notifySlack?: boolean;
}

function formatE2ESlackReport(
  title: string,
  summary: { total: number; passed: number; failed: number; duration: number },
  failures: E2ETestResult[]
) {
  const blocks: Array<Record<string, unknown>> = [];

  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `${title} 测试报告`, emoji: true },
  });
  blocks.push({ type: 'divider' });

  const statusEmoji = summary.failed === 0 ? '✅' : '⚠️';
  const durationText = summary.duration >= 1000
    ? `${(summary.duration / 1000).toFixed(1)}s`
    : `${summary.duration}ms`;

  blocks.push({
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*状态:*\n${statusEmoji} ${summary.passed}/${summary.total} 通过` },
      { type: 'mrkdwn', text: `*耗时:*\n${durationText}` },
    ],
  });

  if (failures.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*失败用例 (${failures.length}):*` },
    });

    failures.forEach((f, i) => {
      let text = `*${i + 1}. ${f.testCase.name}*\n`;
      text += `URL: \`${f.testCase.url}\`\n`;
      if (f.error) text += `错误: ${f.error}`;
      blocks.push({ type: 'section', text: { type: 'mrkdwn', text } });
    });
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `执行时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}` },
    ],
  });

  return blocks;
}

export function initScheduler() {
  scheduler.registerHandler(TOOL_ID, async (job: ScheduledJob) => {
    const config = job.config as ScheduleConfig;

    if (!config.collectionId) {
      console.error('No collectionId in E2E scheduled job config');
      return { success: false };
    }

    const collection = e2eCollectionStore.getById(config.collectionId);
    if (!collection) {
      console.error(`E2E Collection ${config.collectionId} not found for scheduled job`);
      return { success: false };
    }

    const testCases = collection.testCases;
    if (testCases.length === 0) {
      console.error('No test cases in E2E collection for scheduled job');
      return { success: false };
    }

    const results: E2ETestResult[] = [];
    const startTime = Date.now();

    for (const testCase of testCases) {
      const result = await executeE2ETest(testCase);
      results.push(result);
    }

    const totalDuration = Date.now() - startTime;
    const summary = {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      duration: totalDuration,
    };

    if ((config.notifySlack ?? true) && process.env.SLACK_WEBHOOK_URL) {
      try {
        const collectionName = collection.name;
        const failures = results.filter((r) => !r.passed);
        const blocks = formatE2ESlackReport(`E2E Tester — ${collectionName}`, summary, failures);
        await sendSlackMessage(process.env.SLACK_WEBHOOK_URL, blocks as any);
      } catch (error) {
        console.error('Failed to send E2E Slack notification:', error);
      }
    }

    return {
      success: summary.failed === 0,
      summary,
    };
  });
}

export function getSchedule(collectionId: string) {
  return scheduler.getJob(getJobId(collectionId));
}

export function getAllSchedules() {
  return scheduler.getJobs().filter((j) => j.toolId === TOOL_ID);
}

export async function updateSchedule(
  collectionId: string,
  cron: string,
  enabled: boolean,
  config: ScheduleConfig
) {
  const jobId = getJobId(collectionId);
  const fullConfig: ScheduleConfig = { ...config, collectionId };
  const existingJob = scheduler.getJob(jobId);

  if (existingJob) {
    await scheduler.updateCron(jobId, cron);
    await scheduler.updateConfig(jobId, fullConfig);
    if (enabled !== existingJob.enabled) {
      if (enabled) {
        await scheduler.enable(jobId);
      } else {
        await scheduler.disable(jobId);
      }
    }
  } else {
    await scheduler.register({
      id: jobId,
      toolId: TOOL_ID,
      cron,
      enabled,
      config: fullConfig,
    });
  }

  return scheduler.getJob(jobId);
}

export async function runScheduleNow(collectionId: string) {
  return await scheduler.runNow(getJobId(collectionId));
}
