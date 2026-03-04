"use client";

import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DeadLinkResult, PageDeadLinkResult } from "../types";

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

export function ExportSingleDeadLinkButtons({
  result,
}: {
  result: DeadLinkResult;
}) {
  const exportJson = () => {
    const json = JSON.stringify(result, null, 2);
    downloadFile(
      json,
      `dead-link-${generateTimestamp()}.json`,
      "application/json"
    );
  };

  const exportHtml = () => {
    const html = generateSingleHtml(result);
    downloadFile(html, `dead-link-${generateTimestamp()}.html`, "text/html");
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

export function ExportBatchDeadLinkButtons({
  results,
  onRerunFailed,
}: {
  results: PageDeadLinkResult[];
  onRerunFailed?: () => void;
}) {
  const failedCount = results.filter(
    (r) => r.status === "fail" || r.status === "error"
  ).length;

  const exportJson = () => {
    const totalDead = results.reduce((sum, r) => sum + r.deadCount, 0);
    const data = {
      timestamp: new Date().toISOString(),
      totalPages: results.length,
      totalDeadLinks: totalDead,
      summary: {
        pass: results.filter((r) => r.status === "pass").length,
        warn: results.filter((r) => r.status === "warn").length,
        fail: results.filter((r) => r.status === "fail").length,
        error: results.filter((r) => r.status === "error").length,
      },
      results,
    };
    const json = JSON.stringify(data, null, 2);
    downloadFile(
      json,
      `site-dead-links-${generateTimestamp()}.json`,
      "application/json"
    );
  };

  const exportHtml = () => {
    const html = generateBatchHtml(results);
    downloadFile(
      html,
      `site-dead-links-${generateTimestamp()}.html`,
      "text/html"
    );
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

function generateSingleHtml(result: DeadLinkResult): string {
  const rows = result.links
    .map(
      (link) =>
        `<tr>
      <td>${statusEmoji(link.status)} ${link.statusCode ?? link.status}</td>
      <td><a href="${link.url}" target="_blank"><code>${link.url}</code></a>${link.errorMessage ? `<br><small style="color:#b45309">${link.errorMessage}</small>` : ""}${link.redirectedTo ? `<br><small style="color:#6b7280">&rarr; ${link.redirectedTo}</small>` : ""}</td>
      <td>${link.text || "&mdash;"}</td>
      <td style="text-align:right">${link.durationMs > 0 ? link.durationMs : "&mdash;"}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Dead Link Report</title>
<style>body{font-family:system-ui;max-width:1200px;margin:0 auto;padding:20px}
table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:14px}
th{background:#f8fafc}code{font-size:12px;word-break:break-all}
h2{margin-top:32px}</style>
</head><body>
<h1>Dead Link Report</h1>
<p>页面: <code>${result.pageUrl}</code></p>
<p>时间: ${new Date(result.timestamp).toLocaleString()}</p>
<p>总计 ${result.summary.total} 个链接 — ${result.summary.dead} 死链, ${result.summary.alive} 正常, ${result.summary.blocked} 被拦截, ${result.summary.skipped} 跳过, ${result.summary.error} 错误</p>
<table><tr><th>状态</th><th>URL</th><th>链接文本</th><th>耗时(ms)</th></tr>${rows}</table>
</body></html>`;
}

function generateBatchHtml(results: PageDeadLinkResult[]): string {
  const pass = results.filter((r) => r.status === "pass").length;
  const warn = results.filter((r) => r.status === "warn").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const err = results.filter((r) => r.status === "error").length;
  const totalDead = results.reduce((sum, r) => sum + r.deadCount, 0);

  const summaryRows = results
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
      <td style="text-align:center">${r.deadCount}</td>
      <td style="text-align:center">${r.totalLinks}</td>
      <td>${(r.duration / 1000).toFixed(1)}s</td>
    </tr>`
    )
    .join("");

  const detailSections = results
    .filter((r) => r.result && r.deadCount > 0)
    .map((r) => {
      const deadLinks = r.result!.links.filter((l) => l.status === "dead");
      const linkRows = deadLinks
        .map(
          (link) =>
            `<tr>
          <td>${link.statusCode ?? "—"}</td>
          <td><a href="${link.url}" target="_blank"><code>${link.url}</code></a></td>
          <td>${link.text || "&mdash;"}</td>
        </tr>`
        )
        .join("");
      return `<h3>${r.path} — ${deadLinks.length} 个死链</h3>
<table><tr><th>状态码</th><th>URL</th><th>链接文本</th></tr>${linkRows}</table>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Site Dead Link Report</title>
<style>body{font-family:system-ui;max-width:1200px;margin:0 auto;padding:20px}
table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:14px}
th{background:#f8fafc}code{font-size:12px;word-break:break-all}
h2{margin-top:32px}h3{margin-top:24px}</style>
</head><body>
<h1>Site Dead Link Report</h1>
<p>共 ${results.length} 个页面 — ✅ ${pass} 通过 ⚠️ ${warn} 警告 ❌ ${fail} 失败 💥 ${err} 错误 — 共 ${totalDead} 个死链</p>

<h2>总览</h2>
<table><tr><th>#</th><th>路径</th><th>状态</th><th>死链</th><th>总链接</th><th>耗时</th></tr>${summaryRows}</table>

${detailSections ? `<h2>死链详情</h2>${detailSections}` : ""}
</body></html>`;
}

function statusEmoji(status: string): string {
  switch (status) {
    case "alive":
      return "✅";
    case "dead":
      return "❌";
    case "blocked":
      return "🚫";
    case "error":
      return "⚠️";
    case "skipped":
      return "⏭️";
    default:
      return "";
  }
}
