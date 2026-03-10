---
stepsCompleted: [1]
inputDocuments: []
session_topic: '页面功能 E2E 测试工具 — 基于浏览器自动化的在线工具页面功能验证与监控'
session_goals: '讨论出可落地的工具方案，包括可行性评估、UI/UX 交互设计、技术架构'
selected_approach: ''
techniques_used: []
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Johnnyyan
**Date:** 2026-03-08

## Session Overview

**Topic:** 页面功能 E2E 测试工具 — 基于浏览器自动化的在线工具页面功能验证与监控
**Goals:** 讨论出可落地的工具方案，包括可行性、UI/UX、技术架构

### Context

- 现有项目已有 URL Tester（HTTP 级别测试），新工具是"浏览器操作级别"的升级
- 测试场景：Notta 的在线工具页面（如 audio-to-text-converter），模拟用户上传文件、检查处理结果
- 主要用户：开发者、QA、PM
- 使用模式：配置好后无人值守，定时自动执行，失败发 Slack 报告
- 后端已有 Playwright 依赖，具备浏览器自动化基础

---

## 头脑风暴结论

### 核心决策

| 决策项 | 结论 | 理由 |
|--------|------|------|
| 工具名称 | E2E Tester | 区别于 URL Tester（HTTP 级别），强调端到端浏览器操作 |
| 测试方式 | 纯 Playwright 脚本 | 配置者是开发者，代码最精确最灵活 |
| 脚本存储 | JSON 文件持久化 | 复用现有 collections.json 模式 |
| 测试资源 | 本地文件目录 `backend/test-assets/` | 简单直接，不需要额外上传管理 |
| 脚本编辑 | Web UI 内嵌代码编辑器（Monaco Editor） | 方便在线编辑和查看 |
| 脚本上下文 | 系统自动打开页面，注入 `page`、`url`、`assert` | 减少样板代码 |
| UI 布局 | 和 URL Tester 类似风格 | 统一体验，左侧用例列表 + 右侧编辑器/结果 |
| 集合系统 | 复用现有 collection 架构 | 可按工具类型分组 |
| 定时执行 | 复用现有 scheduler | 每个集合独立 cron |
| 通知 | 复用现有 Slack 机制 | 失败时发送报告 |

### 数据模型

```typescript
interface E2ETestCase {
  id: string;
  name: string;
  url: string;               // 系统自动 page.goto(url)
  script: string;             // Playwright 脚本（page 已打开 url）
  timeout: number;            // 超时时间 ms，默认 60000
  tags?: string[];
}

interface E2ETestResult {
  testCase: E2ETestCase;
  passed: boolean;
  durationMs: number;
  error?: string;             // 失败时的错误信息
  screenshot?: string;        // 失败时的截图路径/base64
  consoleLogs?: string[];     // 页面控制台日志
}
```

### 脚本运行上下文

系统自动注入以下变量，用户脚本无需手动创建：

- `page` — 已执行 `page.goto(url)` 的 Playwright Page 实例
- `url` — 测试用例配置的 URL
- `assert(condition, message)` — 断言工具函数

用户脚本示例：

```javascript
// Audio to Text 功能测试
// page 已自动打开 url，直接操作即可

await page.setInputFiles('input[type="file"]', './test-assets/test.mp3');
await page.waitForSelector('.transcript-result', { timeout: 60000 });

const text = await page.textContent('.transcript-result');
assert(text && text.length > 0, '转写结果不应为空');
```

### 执行结果记录

- 通过/失败状态
- 总耗时
- 失败时的错误信息
- 失败时的页面截图（Playwright 自动截图）
- 页面控制台日志

### UI 布局

```
┌──────────────────────────┬──────────────────────────┐
│ 集合选择 + 用例列表       │ 代码编辑器 / 执行结果    │
│                          │                          │
│ #1 Audio to Text    ✅   │ [编辑] [结果] Tab 切换    │
│ #2 Video to Text    ❌   │                          │
│ #3 YouTube Summary  ✅   │ // 脚本内容...            │
│                          │ await page.setInput...   │
│ [+ 添加] [运行全部]      │                          │
└──────────────────────────┴──────────────────────────┘
```

### 复用的现有基础设施

- `backend/src/shared/scheduler.ts` — 定时任务调度
- `backend/src/shared/slack.ts` — Slack 通知 & 报告格式化
- `backend/src/shared/task-manager.ts` — 长任务管理 + WebSocket 进度
- `frontend collection/scheduler UI 组件` — 集合选择器、定时面板等
- Playwright 依赖已在 backend/package.json 中

### 需要新增的部分

- `backend/src/tools/e2e-tester/` — 新工具目录
  - `routes.ts` — API 路由
  - `collections.ts` — 集合存储
  - `executor.ts` — Playwright 脚本执行引擎
  - `scheduler.ts` — 定时任务配置
- `frontend/src/app/tools/e2e-tester/page.tsx` — 工具页面
- `frontend/src/tools/e2e-tester/` — 组件、hooks、types
- Monaco Editor 依赖（`@monaco-editor/react`）
