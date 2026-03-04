"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Lightbulb } from "lucide-react";

const STEPS = [
  {
    num: "1",
    title: "启动扫描",
    color: "bg-blue-500",
    desc: "在「页面扫描」Tab 点击「启动扫描」。工具会先读取 sitemap 把所有页面写入数据库，然后逐页对比旧站（Gatsby）和新站（Next.js）的 HTTP 状态码、SEO 标签（title/description/canonical）、页面文本相似度、链接和图片变化。",
    tip: "5000 页建议设每批 50～100 页，开启「自动连续扫描」让它跑完即可。",
  },
  {
    num: "2",
    title: "查看页面结果",
    color: "bg-blue-500",
    desc: "扫描完成后，点击任意行可查看该页面的详细 diff：哪个 SEO 字段不匹配、文本相似度多少、链接/图片增减了哪些。",
    tip: "用「失败」过滤快速定位问题页面；「警告」表示有轻微差异，不影响 SEO。",
  },
  {
    num: "3",
    title: "导入变更记录",
    color: "bg-purple-500",
    desc: "切换到「变更记录」Tab，上传 CSV（两列：pr_url, description）。每一行对应一个需求 PR，描述这次 PR 改了什么，例如「修改了首页 Banner 背景色」。",
    tip: "CSV 表头可选，有无都能解析。可直接从 Notion/Google Sheets 导出。",
  },
  {
    num: "4",
    title: "AI 分析关联页面",
    color: "bg-purple-500",
    desc: "点击「AI 分析全部」，工具会把每条变更描述和所有存在差异的页面列表发给 Claude，让它推断这条变更最可能影响哪些页面，并给出 0～100 的置信度分数和推断理由。",
    tip: "置信度 < 50 的条目需要人工重点核查；≥ 75 的通常可以直接验证通过。",
  },
  {
    num: "5",
    title: "人工复核 & 标记状态",
    color: "bg-orange-500",
    desc: "逐条查看变更记录，对照 AI 推断的关联页面在扫描结果里找到对应差异，判断这条变更是否已在新站正确实现。然后把状态改为「已验证」（符合预期）或「验证失败」（新站行为不符）。",
    tip: "不需要管的 PR 可以标「已跳过」，只关注 verified/failed 比例。",
  },
  {
    num: "6",
    title: "导出验收报告",
    color: "bg-green-500",
    desc: "右上角点「导出 JSON」或「导出 HTML 报告」。HTML 报告包含所有变更记录的状态、置信度、关联页面和 AI 推断理由，可直接发给 QA 或 PM。",
    tip: "所有变更都标记完状态后，verified 比率即为迁移验收通过率。",
  },
];

export function WorkflowGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          使用流程说明
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-4 bg-muted/20">
          <p className="text-sm text-muted-foreground mb-4">
            Migration Tracker 帮你验证每一条需求变更是否已在新站正确实现，闭环流程如下：
          </p>
          <div className="space-y-4">
            {STEPS.map((step) => (
              <div key={step.num} className="flex gap-3">
                <div className={`${step.color} text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shrink-0 mt-0.5`}>
                  {step.num}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  <p className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 mt-1 inline-flex items-start gap-1">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {step.tip}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
