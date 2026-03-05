import type { LucideIcon } from "lucide-react";
import { FileSearch, Link2Off, GitMerge, Route } from "lucide-react";

export interface ToolMeta {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

export const tools: ToolMeta[] = [
  {
    id: "page-diff",
    name: "Page Diff",
    description: "对比两个网页在 HTTP、SEO、视觉上的差异",
    icon: FileSearch,
    href: "/tools/page-diff",
  },
  {
    id: "dead-link-checker",
    name: "Dead Link Checker",
    description: "检查页面上的死链（4xx/5xx 响应）",
    icon: Link2Off,
    href: "/tools/dead-link-checker",
  },
  {
    id: "migration-tracker",
    name: "Migration Tracker",
    description: "Gatsby → Next.js 迁移验收：批量 Diff + AI 分析变更意图 + 导出报告",
    icon: GitMerge,
    href: "/tools/migration-tracker",
  },
  {
    id: "redirect-tester",
    name: "Redirect Tester",
    description: "CloudFront / Lambda@Edge 重定向规则批量测试与验证",
    icon: Route,
    href: "/tools/redirect-tester",
  },
];
