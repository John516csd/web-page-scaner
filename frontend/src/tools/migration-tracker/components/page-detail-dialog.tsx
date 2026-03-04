"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, ExternalLink } from "lucide-react";
import type { PagePair } from "../types";

interface DiffResult {
  urlA: string;
  urlB: string;
  http?: {
    items: { name: string; valueA: string | number; valueB: string | number; match: boolean }[];
  };
  seo?: {
    items: { name: string; valueA: string | null; valueB: string | null; match: boolean }[];
  };
  content?: {
    text: { similarity: number; added: string[]; removed: string[] };
    links: { countA: number; countB: number; added: { href: string; text: string }[]; removed: { href: string; text: string }[] };
    images: { countA: number; countB: number; added: { src: string; alt: string }[]; removed: { src: string; alt: string }[] };
  };
}

interface Props {
  page: PagePair | null;
  open: boolean;
  onClose: () => void;
}

export function PageDetailDialog({ page, open, onClose }: Props) {
  if (!page) return null;

  let result: DiffResult | null = null;
  let parseError: string | null = null;
  try {
    if (page.diff_result) {
      const parsed = JSON.parse(page.diff_result);
      // Handle error-only result
      if (parsed.error) {
        parseError = parsed.error;
      } else {
        result = parsed as DiffResult;
      }
    }
  } catch {
    parseError = "无法解析结果数据";
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full sm:max-w-[1100px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm break-all pr-4">{page.path}</DialogTitle>
          <div className="flex items-center gap-3 mt-1">
            <DiffStatusBadge status={page.diff_status} />
            {result && (
              <div className="flex gap-3">
                <a href={result.urlA} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                  旧站 <ExternalLink className="h-3 w-3" />
                </a>
                <a href={result.urlB} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                  新站 <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </DialogHeader>

        {parseError && (
          <div className="rounded-md bg-destructive/10 text-destructive text-sm p-3">
            {parseError}
          </div>
        )}

        {result && (
          <div className="space-y-5 mt-2">
            {/* HTTP checks */}
            {result.http && (
              <Section title="HTTP 检查" icon={httpIcon(result.http.items)}>
                <CheckTable
                  rows={result.http.items.map((i) => ({
                    name: i.name,
                    valueA: String(i.valueA),
                    valueB: String(i.valueB),
                    match: i.match,
                  }))}
                  colA="旧站"
                  colB="新站"
                />
              </Section>
            )}

            {/* SEO checks */}
            {result.seo && (
              <Section title="SEO 检查" icon={seoIcon(result.seo.items)}>
                <CheckTable
                  rows={result.seo.items.map((i) => ({
                    name: i.name,
                    valueA: i.valueA ?? "（空）",
                    valueB: i.valueB ?? "（空）",
                    match: i.match,
                  }))}
                  colA="旧站"
                  colB="新站"
                />
              </Section>
            )}

            {/* Content checks */}
            {result.content && (
              <Section title="内容检查" icon={contentIcon(result.content)}>
                <ContentDetail content={result.content} />
              </Section>
            )}
          </div>
        )}

        {!result && !parseError && (
          <p className="text-sm text-muted-foreground py-4">暂无详细数据</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function httpIcon(items: { match: boolean; name: string }[]) {
  const fail = items.some((i) => !i.match && i.name !== "TTFB");
  return fail ? "fail" : "pass";
}
function seoIcon(items: { match: boolean; name: string }[]) {
  const critical = new Set(["title", "description"]);
  const fail = items.some((i) => !i.match && critical.has(i.name));
  return fail ? "fail" : "pass";
}
function contentIcon(c: DiffResult["content"]) {
  if (!c) return "pass";
  if (c.text.similarity < 50) return "fail";
  if (c.text.similarity < 80 || c.links.added.length > 0 || c.links.removed.length > 0) return "warn";
  return "pass";
}

function Section({ title, icon, children }: { title: string; icon: "pass" | "warn" | "fail"; children: React.ReactNode }) {
  const iconEl = icon === "pass"
    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
    : icon === "warn"
    ? <AlertCircle className="h-4 w-4 text-yellow-500" />
    : <XCircle className="h-4 w-4 text-red-500" />;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {iconEl}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function CheckTable({ rows, colA, colB }: {
  rows: { name: string; valueA: string; valueB: string; match: boolean }[];
  colA: string;
  colB: string;
}) {
  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-xs table-fixed">
        <colgroup>
          <col className="w-[120px]" />
          <col />
          <col />
          <col className="w-[40px]" />
        </colgroup>
        <thead className="bg-muted/50">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium">检查项</th>
            <th className="px-2 py-1.5 text-left font-medium">{colA}</th>
            <th className="px-2 py-1.5 text-left font-medium">{colB}</th>
            <th className="px-2 py-1.5 text-center font-medium whitespace-nowrap">结果</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className={`border-t align-top ${r.match ? "" : "bg-red-50"}`}>
              <td className="px-2 py-2 font-medium text-muted-foreground whitespace-nowrap">{r.name}</td>
              <td className="px-2 py-2">
                <div className="line-clamp-3 break-words cursor-default" title={r.valueA || "（空）"}>
                  {r.valueA || <span className="text-muted-foreground">（空）</span>}
                </div>
              </td>
              <td className="px-2 py-2">
                <div className={`line-clamp-3 break-words cursor-default ${!r.match ? "text-red-600 font-medium" : ""}`} title={r.valueB || "（空）"}>
                  {r.valueB || <span className="text-muted-foreground">（空）</span>}
                </div>
              </td>
              <td className="px-2 py-2 text-center">
                {r.match
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mx-auto" />
                  : <XCircle className="h-3.5 w-3.5 text-red-500 mx-auto" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContentDetail({ content }: { content: NonNullable<DiffResult["content"]> }) {
  return (
    <div className="space-y-3 text-xs">
      {/* Text similarity */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-20 shrink-0">文本相似度</span>
        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full ${content.text.similarity >= 80 ? "bg-green-500" : content.text.similarity >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
            style={{ width: `${content.text.similarity}%` }}
          />
        </div>
        <span className={`w-10 text-right font-medium ${content.text.similarity >= 80 ? "text-green-600" : content.text.similarity >= 50 ? "text-yellow-600" : "text-red-600"}`}>
          {Math.round(content.text.similarity)}%
        </span>
      </div>

      {/* Links diff */}
      <DiffList
        label="链接"
        countA={content.links.countA}
        countB={content.links.countB}
        added={content.links.added.map((l) => l.href)}
        removed={content.links.removed.map((l) => l.href)}
      />

      {/* Images diff */}
      <DiffList
        label="图片"
        countA={content.images.countA}
        countB={content.images.countB}
        added={content.images.added.map((i) => i.src)}
        removed={content.images.removed.map((i) => i.src)}
      />

      {/* Text snippets */}
      {content.text.removed.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1">旧站有、新站没有的文本片段（最多 5 条）：</p>
          <ul className="space-y-0.5">
            {content.text.removed.slice(0, 5).map((t, i) => (
              <li key={i} className="bg-red-50 border border-red-100 rounded px-2 py-1 text-red-700 line-clamp-2">{t}</li>
            ))}
          </ul>
        </div>
      )}
      {content.text.added.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1">新站有、旧站没有的文本片段（最多 5 条）：</p>
          <ul className="space-y-0.5">
            {content.text.added.slice(0, 5).map((t, i) => (
              <li key={i} className="bg-green-50 border border-green-100 rounded px-2 py-1 text-green-700 line-clamp-2">{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DiffList({ label, countA, countB, added, removed }: {
  label: string;
  countA: number;
  countB: number;
  added: string[];
  removed: string[];
}) {
  const hasChanges = added.length > 0 || removed.length > 0;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground w-20 shrink-0">{label}</span>
        <span className="text-muted-foreground">旧站 {countA} 个 → 新站 {countB} 个</span>
        {!hasChanges && <Badge className="bg-green-100 text-green-700 text-xs">无变化</Badge>}
      </div>
      {removed.length > 0 && (
        <ul className="mb-1 space-y-0.5">
          {removed.slice(0, 5).map((s, i) => (
            <li key={i} className="flex items-start gap-1 text-red-600">
              <span className="shrink-0">−</span>
              <span className="break-all">{s}</span>
            </li>
          ))}
          {removed.length > 5 && <li className="text-muted-foreground">…另 {removed.length - 5} 条</li>}
        </ul>
      )}
      {added.length > 0 && (
        <ul className="space-y-0.5">
          {added.slice(0, 5).map((s, i) => (
            <li key={i} className="flex items-start gap-1 text-green-600">
              <span className="shrink-0">+</span>
              <span className="break-all">{s}</span>
            </li>
          ))}
          {added.length > 5 && <li className="text-muted-foreground">…另 {added.length - 5} 条</li>}
        </ul>
      )}
    </div>
  );
}

function DiffStatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; className: string }> = {
    pass: { label: "通过", className: "bg-green-100 text-green-700" },
    warn: { label: "警告", className: "bg-yellow-100 text-yellow-700" },
    fail: { label: "失败", className: "bg-red-100 text-red-700" },
    error: { label: "出错", className: "bg-gray-100 text-gray-700" },
  };
  if (!status || !map[status]) return null;
  const v = map[status];
  return <Badge className={v.className}>{v.label}</Badge>;
}
