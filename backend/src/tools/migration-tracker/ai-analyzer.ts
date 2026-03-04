import Anthropic from '@anthropic-ai/sdk';
import { taskManager } from '../../shared/task-manager.js';
import {
  getSession,
  getDiffPages,
  getPendingChanges,
  updateChangeAnalysis,
} from './db.js';

const client = new Anthropic();
const ANALYZE_TOOL_ID = 'migration-tracker-analyze';

taskManager.registerHandler(ANALYZE_TOOL_ID, async (_taskId, payload, emit, signal) => {
  const { sessionId } = payload as { sessionId: number };

  const session = getSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const pendingChanges = getPendingChanges(sessionId);
  if (pendingChanges.length === 0) {
    emit({ type: 'complete', result: { analyzed: 0 } });
    return;
  }

  // Get pages with diffs to reduce token usage
  const diffPages = getDiffPages(sessionId, ['warn', 'fail']);
  const pagesSummary = diffPages
    .slice(0, 200) // Cap at 200 pages to avoid huge prompts
    .map((p) => {
      let textSim = 'N/A';
      let visualDiff = 'N/A';
      if (p.diff_result) {
        try {
          const r = JSON.parse(p.diff_result);
          if (r.content?.text?.similarity !== undefined) {
            textSim = `${Math.round(r.content.text.similarity)}%`;
          }
          if (r.visual?.viewports?.[0]?.diffPercentage !== undefined) {
            visualDiff = `${r.visual.viewports[0].diffPercentage.toFixed(1)}%`;
          }
        } catch { /* ignore */ }
      }
      return `${p.path} | ${p.diff_status} | visual:${visualDiff} | text:${textSim}`;
    })
    .join('\n');

  let analyzed = 0;
  for (const change of pendingChanges) {
    if (signal.aborted) break;

    emit({ type: 'progress', step: 'analyze', status: 'running', message: `分析变更 ${change.id}: ${change.description.slice(0, 50)}...` });

    try {
      const prompt = `你是一个网站迁移验收专家。请分析以下变更记录，找出它最可能影响的页面。

变更描述: ${change.description}
PR 链接: ${change.pr_url}

以下页面在 Gatsby 和 Next.js 之间存在差异（格式：路径 | 状态 | 视觉差异% | 文本相似度%）：
${pagesSummary || '（暂无差异页面）'}

请根据变更描述推断哪些页面受到了影响。输出 JSON 格式（不要有其他文字）：
{
  "affected_paths": ["/path1", "/path2"],
  "confidence_score": 85,
  "reasoning": "推断理由..."
}

confidence_score 范围 0-100，表示你对这个判断的置信度。`;

      const response = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          affected_paths: string[];
          confidence_score: number;
          reasoning: string;
        };
        updateChangeAnalysis(
          change.id,
          parsed.affected_paths || [],
          Math.min(100, Math.max(0, parsed.confidence_score || 0)),
          parsed.reasoning || ''
        );
      }

      analyzed++;
      emit({
        type: 'progress',
        step: 'analyze',
        status: 'done',
        data: { changeId: change.id, analyzed, total: pendingChanges.length },
      });
    } catch (err) {
      emit({
        type: 'progress',
        step: 'analyze',
        status: 'error',
        message: `变更 ${change.id} 分析失败: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  emit({ type: 'complete', result: { analyzed } });
});

export function startAnalysis(sessionId: number): string {
  return taskManager.createTask(ANALYZE_TOOL_ID, { sessionId });
}
