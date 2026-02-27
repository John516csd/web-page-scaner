# Web Page Scanner

Web Page 工具集合平台 — 网页检测、对比、分析。

## 工具列表

### Page Diff
对比两个网页在 HTTP、SEO、视觉上的差异。

- **单页对比** — 输入两个 URL，看 HTTP 状态码/SEO 元素/视觉截图的差异
- **站点对比** — 通过 sitemap 或手动输入路径列表，分批逐页对比整站
- **实时进度** — WebSocket 推送对比进度，结果增量展示
- **导出报告** — 支持 JSON / HTML 格式导出

## 技术栈

- **前端**: Next.js 16 (App Router) + Tailwind CSS v4 + TypeScript
- **后端**: Fastify v5 + TypeScript + Playwright + pixelmatch + cheerio
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
├── frontend/          # Next.js 前端 (端口 3000)
│   ├── app/           #   App Router 页面
│   ├── components/    #   共享 UI 组件
│   └── tools/         #   工具业务逻辑
├── backend/           # Fastify 后端 (端口 3001)
│   └── src/
│       ├── shared/    #   共享基础设施
│       └── tools/     #   各工具模块
└── docs/              # 设计文档
```

## 添加新工具

1. 前端: 在 `frontend/app/tools/` 下新建页面目录，在 `frontend/tools/registry.ts` 注册
2. 后端: 在 `backend/src/tools/` 下新建模块目录，在 `backend/src/server.ts` 注册插件
3. 首页自动出现新工具卡片
