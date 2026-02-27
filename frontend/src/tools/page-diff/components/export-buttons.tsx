"use client";

import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiffResult, PageResult } from "../types";

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generateTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function ExportSingleButtons({ result }: { result: DiffResult }) {
  const exportJson = () => {
    const json = JSON.stringify(result, null, 2);
    downloadFile(json, `page-diff-${generateTimestamp()}.json`, "application/json");
  };

  const exportHtml = () => {
    const html = generateSingleHtml(result);
    downloadFile(html, `page-diff-${generateTimestamp()}.html`, "text/html");
  };

  return (
    <div className="flex gap-2 mt-6">
      <Button variant="outline" onClick={exportJson}>
        <Download className="mr-1 h-4 w-4" />
        导出 JSON
      </Button>
      <Button variant="outline" onClick={exportHtml}>
        <Download className="mr-1 h-4 w-4" />
        导出 HTML
      </Button>
    </div>
  );
}

export function ExportBatchButtons({
  results,
  onRerunFailed,
}: {
  results: PageResult[];
  onRerunFailed?: () => void;
}) {
  const failedCount = results.filter(
    (r) => r.status === "fail" || r.status === "error"
  ).length;

  const exportJson = () => {
    const data = {
      timestamp: new Date().toISOString(),
      totalPages: results.length,
      summary: {
        pass: results.filter((r) => r.status === "pass").length,
        warn: results.filter((r) => r.status === "warn").length,
        fail: results.filter((r) => r.status === "fail").length,
        error: results.filter((r) => r.status === "error").length,
      },
      results,
    };
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `site-diff-${generateTimestamp()}.json`, "application/json");
  };

  const exportHtml = () => {
    const html = generateBatchHtml(results);
    downloadFile(html, `site-diff-${generateTimestamp()}.html`, "text/html");
  };

  return (
    <div className="flex gap-2 mt-6">
      <Button variant="outline" onClick={exportJson}>
        <Download className="mr-1 h-4 w-4" />
        导出 JSON
      </Button>
      <Button variant="outline" onClick={exportHtml}>
        <Download className="mr-1 h-4 w-4" />
        导出 HTML
      </Button>
      {failedCount > 0 && onRerunFailed && (
        <Button variant="destructive" onClick={onRerunFailed}>
          <RotateCcw className="mr-1 h-4 w-4" />
          重跑失败项 ({failedCount} 个)
        </Button>
      )}
    </div>
  );
}

function generateSingleHtml(result: DiffResult): string {
  const httpRows = result.http?.items
    .map(
      (item) =>
        `<tr>
      <td>${item.name}</td>
      <td><code>${item.valueA ?? "(缺失)"}</code></td>
      <td><code>${item.valueB ?? "(缺失)"}</code></td>
      <td>${item.match ? "✅" : "❌"}</td>
    </tr>`
    )
    .join("") || "";

  const seoRows = result.seo?.items
    .map(
      (item) =>
        `<tr>
      <td>${item.name}</td>
      <td><code>${item.valueA ?? "(缺失)"}</code></td>
      <td><code>${item.valueB ?? "(缺失)"}</code></td>
      <td>${item.match ? "✅" : "❌"}</td>
    </tr>`
    )
    .join("") || "";

  const visualHtml = result.visual?.viewports
    .map(
      (vp) =>
        `<h3>${vp.viewport} — 差异 ${vp.diffPercentage}%</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">
      <div><p style="text-align:center;font-size:12px">基准</p><img src="data:image/png;base64,${vp.screenshotA}" style="width:100%"></div>
      <div><p style="text-align:center;font-size:12px">差异图</p><img src="data:image/png;base64,${vp.diffImage}" style="width:100%"></div>
      <div><p style="text-align:center;font-size:12px">对比</p><img src="data:image/png;base64,${vp.screenshotB}" style="width:100%"></div>
    </div>`
    )
    .join("") || "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Page Diff Report</title>
<style>body{font-family:system-ui;max-width:1200px;margin:0 auto;padding:20px}
table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:14px}
th{background:#f8fafc}code{font-size:12px;word-break:break-all}
h2{margin-top:32px}h3{margin-top:24px}</style>
</head><body>
<h1>Page Diff Report</h1>
<p>基准 (Baseline): <code>${result.urlA}</code></p>
<p>对比 (Compare): <code>${result.urlB}</code></p>
<p>时间: ${new Date(result.timestamp).toLocaleString()}</p>
${httpRows ? `<h2>HTTP 对比</h2><table><tr><th>检查项</th><th>基准</th><th>对比</th><th>状态</th></tr>${httpRows}</table>` : ""}
${seoRows ? `<h2>SEO 对比</h2><table><tr><th>检查项</th><th>基准</th><th>对比</th><th>状态</th></tr>${seoRows}</table>` : ""}
${visualHtml ? `<h2>视觉对比</h2>${visualHtml}` : ""}
</body></html>`;
}

function generateBatchHtml(results: PageResult[]): string {
  const pass = results.filter((r) => r.status === "pass").length;
  const warn = results.filter((r) => r.status === "warn").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const err = results.filter((r) => r.status === "error").length;

  const rows = results
    .map(
      (r, i) =>
        `<tr>
      <td>${i + 1}</td>
      <td><code>${r.path}</code></td>
      <td>${
        r.status === "pass"
          ? "✅ 通过"
          : r.status === "warn"
            ? "⚠️ 警告"
            : r.status === "fail"
              ? "❌ 失败"
              : "💥 错误"
      }</td>
      <td>${(r.duration / 1000).toFixed(1)}s</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Site Diff Report</title>
<style>body{font-family:system-ui;max-width:1000px;margin:0 auto;padding:20px}
table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:14px}
th{background:#f8fafc}code{font-size:12px}</style>
</head><body>
<h1>Site Diff Report</h1>
<p>共 ${results.length} 个页面 — ✅ ${pass} 通过 ⚠️ ${warn} 警告 ❌ ${fail} 失败 💥 ${err} 错误</p>
<table><tr><th>#</th><th>路径</th><th>状态</th><th>耗时</th></tr>${rows}</table>
</body></html>`;
}
