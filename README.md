# Web Page Scanner

Web Page 工具集合平台 — 网页检测、对比、分析。

## 工具列表

### Page Diff
对比两个网页在 HTTP、SEO、视觉上的差异。

- **单页对比** — 输入两个 URL，看 HTTP 状态码/SEO 元素/视觉截图的差异
- **站点对比** — 通过 sitemap 或手动输入路径列表，分批逐页对比整站
- **并发处理** — 批量对比时支持页面级并发，可配置并发数
- **自动运行** — 可选"自动跑完所有批次"模式，无需手动点击下一批
- **导出报告** — 支持 JSON / HTML 格式导出

### Dead Link Checker
检查页面上的死链（4xx/5xx 响应）。

- **单页检查** — 输入 URL，扫描页面上所有链接并检测状态
- **站点检查** — 通过 sitemap 批量检查整站所有页面的链接
- **死链汇总** — 跨页面去重汇总所有死链，显示出现页面
- **智能识别** — 区分真正死链和被反爬机制拦截的链接（blocked 状态）
- **并发处理** — 支持链接并发和页面并发，加速检测
- **导出报告** — 支持 JSON / HTML 格式导出

### Migration Tracker
Gatsby → Next.js 迁移验收：批量 Diff + AI 分析变更意图 + 导出报告。

### Redirect Tester
CloudFront / Lambda@Edge 重定向规则批量测试与验证。

- **预置用例** — 内置 16 个测试用例，覆盖 Viewer Request、Origin Request、多语言重定向等场景
- **自定义用例** — 支持添加/编辑/删除测试用例，配置 Headers、Cookies、预期状态码和重定向 URL
- **代理支持** — 通过 HTTP 代理发送请求，模拟不同国家 IP 访问
- **自动切国家** — 集成 mihomo (Clash Meta) API，为标记了国家的用例自动切换 VPN 节点，测试完自动恢复
- **连接预检** — 运行前检测代理连通性，VPN 未开启时给出提示
- **稳定结果视图** — 预渲染所有用例行，结果就地填充不跳动
- **详情查看** — 点击用例查看预期 vs 实际对比、响应头、失败原因，支持一键复制 curl 命令

## 技术栈

- **前端**: Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + shadcn/ui + TypeScript
- **后端**: Fastify v5 + TypeScript + Playwright + pixelmatch + cheerio + undici
- **通信**: WebSocket 实时进度推送 + AbortController 任务取消
- **Monorepo**: pnpm workspaces

## 快速开始

```bash
# 安装依赖
pnpm install

# 安装 Playwright 浏览器（视觉对比需要）
cd backend && npx playwright install chromium && cd ..

# 启动开发服务
pnpm dev

# 打开浏览器
# → http://localhost:3000
```

## 项目结构

```
web-page-scanner/
├── frontend/                    # Next.js 前端 (端口 3000)
│   ├── src/
│   │   ├── app/                 #   App Router 页面
│   │   │   └── tools/           #   各工具页面
│   │   ├── components/          #   共享 UI 组件 (shadcn/ui)
│   │   ├── lib/                 #   工具函数 (api, utils)
│   │   └── tools/               #   工具业务逻辑
│   │       ├── registry.ts      #   工具注册表
│   │       ├── page-diff/       #   Page Diff 组件/hooks/types
│   │       ├── dead-link-checker/ # Dead Link Checker
│   │       ├── redirect-tester/ #   Redirect Tester
│   │       └── migration-tracker/ # Migration Tracker
│   └── next.config.ts           #   API/WS 反向代理配置
├── backend/                     # Fastify 后端 (端口 3001)
│   └── src/
│       ├── server.ts            #   入口，插件注册
│       ├── types.ts             #   全局类型 (TaskEvent, TaskHandler)
│       ├── shared/              #   共享基础设施
│       │   ├── task-manager.ts  #   任务管理 + WebSocket 推送
│       │   ├── sitemap.ts       #   Sitemap 解析
│       │   └── browser.ts      #   Playwright 浏览器管理
│       └── tools/               #   各工具模块
│           ├── page-diff/
│           ├── dead-link-checker/
│           ├── redirect-tester/
│           └── migration-tracker/
└── package.json                 #   Monorepo 根配置
```

## 添加新工具

1. **后端**: 在 `backend/src/tools/<tool-id>/` 下创建 `index.ts`、`routes.ts`、`types.ts`，在 `server.ts` 注册插件
2. **前端**: 在 `frontend/src/tools/<tool-id>/` 下创建组件/hooks/types，在 `frontend/src/app/tools/<tool-id>/page.tsx` 创建页面，在 `registry.ts` 注册
3. 首页自动出现新工具卡片
