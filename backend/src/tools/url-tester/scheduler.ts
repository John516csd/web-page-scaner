import { scheduler, type ScheduledJob } from '../../shared/scheduler.js';
import { executeTest } from './test-executor.js';
import { sendSlackMessage, formatTestReport } from '../../shared/slack.js';
import { collectionStore } from './collections.js';
import type { UrlTestCase, UrlTestResult } from './types.js';

const TOOL_ID = 'url-tester';

function getJobId(collectionId: string) {
  return `url-tester-${collectionId}`;
}

export interface ScheduleConfig {
  [key: string]: unknown;
  collectionId?: string;
  caseIds?: string[];
  notifySlack?: boolean;
  testCases?: UrlTestCase[];
}

export function sanitizeScheduleConfig(config: ScheduleConfig & { proxy?: unknown }): ScheduleConfig {
  const { proxy: _legacyProxy, ...configWithoutProxy } = config;
  return configWithoutProxy;
}

export function initScheduler() {
  scheduler.registerHandler(TOOL_ID, async (job: ScheduledJob) => {
    const config = job.config as ScheduleConfig;

    let testCases: UrlTestCase[] = [];

    if (config.collectionId) {
      const collection = collectionStore.getById(config.collectionId);
      if (collection) {
        testCases = collection.testCases;
      } else {
        console.error(`Collection ${config.collectionId} not found for scheduled job`);
        return { success: false };
      }
    } else if (config.testCases && config.testCases.length > 0) {
      testCases = config.testCases;
    }

    if (testCases.length === 0) {
      console.error('No test cases configured for scheduled job');
      return { success: false };
    }

    if (config.caseIds && config.caseIds.length > 0) {
      testCases = testCases.filter((tc) => config.caseIds!.includes(tc.id));
    }

    if (testCases.length === 0) {
      console.error('No test cases matched the filter criteria');
      return { success: false };
    }

    const results: UrlTestResult[] = [];
    const startTime = Date.now();

    for (const testCase of testCases) {
      const result = await executeTest(testCase);
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
        const collectionName = config.collectionId
          ? collectionStore.getById(config.collectionId)?.name || config.collectionId
          : 'URL Tester';

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

        const blocks = formatTestReport(
          `URL Tester — ${collectionName}`,
          summary,
          failures,
          process.env.SLACK_FAILURE_MENTION
        );
        await sendSlackMessage(process.env.SLACK_WEBHOOK_URL, blocks);
      } catch (error) {
        console.error('Failed to send Slack notification:', error);
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
  const configWithoutProxy = sanitizeScheduleConfig(config as ScheduleConfig & { proxy?: unknown });
  const fullConfig: ScheduleConfig = { ...configWithoutProxy, collectionId };
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
