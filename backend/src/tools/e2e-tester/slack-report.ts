import type { E2ETestResult } from './types.js';

type SlackBlock = Record<string, unknown>;

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  duration: number;
}

export function formatE2ESlackReport(
  title: string,
  summary: TestSummary,
  failures: E2ETestResult[],
  failureMention?: string
) {
  const blocks: SlackBlock[] = [];

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

    if (failureMention) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${failureMention} E2E 测试报告有失败用例，请关注。`,
        },
      });
    }

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*失败用例 (${failures.length}):*` },
    });

    failures.forEach((f, i) => {
      let text = `*${i + 1}. ${f.testCase.name}*\n`;
      text += `URL: \`${f.testCase.url}\`\n`;
      if (f.error) {
        text += `错误: ${f.error}`;
      }
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
