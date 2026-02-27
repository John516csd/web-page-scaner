import type { LucideIcon } from "lucide-react";
import { FileSearch } from "lucide-react";

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
];
