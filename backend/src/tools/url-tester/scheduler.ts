import { scheduler, type ScheduledJob } from '../../shared/scheduler.js';
import { executeTest } from './test-executor.js';
import { sendSlackMessage, formatTestReport } from '../../shared/slack.js';
import { getCurrentNode, switchToCountry, switchToNode, isAvailable } from './node-switcher.js';
import type { UrlTestCase, UrlTestResult } from './types.js';

const TOOL_ID = 'url-tester';
const JOB_ID = 'url-tester-scheduled';

interface ScheduleConfig {
  caseIds?: string[];
  proxy?: string;
  notifySlack?: boolean;
  testCases?: UrlTestCase[];
}

export function initScheduler() {
  scheduler.registerHandler(TOOL_ID, async (job: ScheduledJob) => {
    const config = job.config as ScheduleConfig;
    
    if (!config.testCases || config.testCases.length === 0) {
      console.error('No test cases configured for scheduled job');
      return { success: false };
    }

    let testCases = config.testCases;

    if (config.caseIds && config.caseIds.length > 0) {
      testCases = testCases.filter((tc) => config.caseIds!.includes(tc.id));
    }

    if (testCases.length === 0) {
      console.error('No test cases matched the filter criteria');
      return { success: false };
    }

    const results: UrlTestResult[] = [];
    const startTime = Date.now();
    const proxy = config.proxy;

    const canSwitch = proxy && await isAvailable();
    const originalNode = canSwitch ? await getCurrentNode() : '';
    let lastCountry: string | undefined;

    try {
      for (const testCase of testCases) {
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

        const result = await executeTest(testCase, proxy);
        result.usedNode = usedNode;
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

    const totalDuration = Date.now() - startTime;
    const summary = {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      duration: totalDuration,
    };

    if ((config.notifySlack ?? true) && process.env.SLACK_WEBHOOK_URL) {
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

        const blocks = formatTestReport('URL Tester (定时任务)', summary, failures);
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

export async function getSchedule() {
  return scheduler.getJob(JOB_ID);
}

export async function updateSchedule(
  cron: string,
  enabled: boolean,
  config: ScheduleConfig
) {
  const existingJob = scheduler.getJob(JOB_ID);

  if (existingJob) {
    await scheduler.updateCron(JOB_ID, cron);
    await scheduler.updateConfig(JOB_ID, config);
    if (enabled !== existingJob.enabled) {
      if (enabled) {
        await scheduler.enable(JOB_ID);
      } else {
        await scheduler.disable(JOB_ID);
      }
    }
  } else {
    await scheduler.register({
      id: JOB_ID,
      toolId: TOOL_ID,
      cron,
      enabled,
      config,
    });
  }

  return scheduler.getJob(JOB_ID);
}

export async function runScheduleNow() {
  return await scheduler.runNow(JOB_ID);
}
