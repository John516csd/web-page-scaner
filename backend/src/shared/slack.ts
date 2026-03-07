interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text: string;
  }>;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  duration: number;
}

interface FailureDetail {
  name: string;
  url: string;
  expectedStatus: number;
  actualStatus: number;
  expectedRedirectUrl?: string;
  actualRedirectUrl?: string;
  failureReason?: string;
}

/**
 * Send a message to Slack using Incoming Webhook
 */
export async function sendSlackMessage(
  webhookUrl: string,
  blocks: SlackBlock[]
): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Slack API error: ${response.status} ${text}`);
    }
  } catch (error) {
    console.error('Failed to send Slack message:', error);
    throw error;
  }
}

/**
 * Format test report as Slack Block Kit blocks
 */
export function formatTestReport(
  toolName: string,
  summary: TestSummary,
  failures: FailureDetail[]
): SlackBlock[] {
  const blocks: SlackBlock[] = [];

  // Header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `${toolName} 测试报告`,
      emoji: true,
    },
  });

  blocks.push({
    type: 'divider',
  });

  // Summary section
  const statusEmoji = summary.failed === 0 ? '✅' : '⚠️';
  const durationText = summary.duration >= 1000 
    ? `${(summary.duration / 1000).toFixed(1)}s` 
    : `${summary.duration}ms`;

  blocks.push({
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*状态:*\n${statusEmoji} ${summary.passed}/${summary.total} 通过`,
      },
      {
        type: 'mrkdwn',
        text: `*耗时:*\n${durationText}`,
      },
    ],
  });

  // Failures section (if any)
  if (failures.length > 0) {
    blocks.push({
      type: 'divider',
    });

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*失败用例 (${failures.length}):*`,
      },
    });

    failures.forEach((failure, index) => {
      let failureText = `*${index + 1}. ${failure.name}*\n`;
      failureText += `URL: \`${failure.url}\`\n`;
      
      if (failure.expectedRedirectUrl || failure.actualRedirectUrl) {
        failureText += `期望: ${failure.expectedStatus}`;
        if (failure.expectedRedirectUrl) {
          failureText += ` → \`${failure.expectedRedirectUrl}\``;
        }
        failureText += `\n实际: ${failure.actualStatus}`;
        if (failure.actualRedirectUrl) {
          failureText += ` → \`${failure.actualRedirectUrl}\``;
        } else {
          failureText += ` (无重定向)`;
        }
      } else {
        failureText += `期望: ${failure.expectedStatus}  实际: ${failure.actualStatus}`;
      }
      
      if (failure.failureReason) {
        failureText += `\n原因: ${failure.failureReason}`;
      }

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: failureText,
        },
      });
    });
  }

  // Footer
  blocks.push({
    type: 'divider',
  });

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `执行时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
      },
    ],
  });

  return blocks;
}
