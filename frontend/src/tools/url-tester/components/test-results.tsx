"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  Copy,
  Check,
  Loader2,
  Circle,
} from "lucide-react";
import type {
  UrlTestResult,
  TestBatchResult,
  UrlTestCase,
} from "../types";

type TestItemStatus = "pending" | "running" | "done";

interface TestResultsProps {
  testCases: UrlTestCase[];
  results: UrlTestResult[];
  summary: TestBatchResult["summary"] | null;
  loading: boolean;
  currentTest: string | null;
  progress: { current: number; total: number } | null;
}

export function TestResults({
  testCases,
  results,
  summary,
  loading,
  currentTest,
  progress,
}: TestResultsProps) {
  const [detailResult, setDetailResult] = useState<UrlTestResult | null>(
    null
  );
  const [copiedCurl, setCopiedCurl] = useState(false);

  const resultMap = useMemo(() => {
    const map = new Map<string, UrlTestResult>();
    results.forEach((r) => map.set(r.testCase.id, r));
    return map;
  }, [results]);

  const runningId = useMemo(() => {
    if (!currentTest || !loading) return null;
    const tc = testCases.find((t) => currentTest.includes(t.name));
    return tc?.id ?? null;
  }, [currentTest, loading, testCases]);

  const copyCurl = (tc: UrlTestCase) => {
    let cmd = `curl -s -o /dev/null -w "%{http_code} %{redirect_url}"`;
    if (tc.headers) {
      Object.entries(tc.headers).forEach(([k, v]) => {
        if (k === "User-Agent") cmd += ` -A "${v}"`;
        else cmd += ` -H "${k}: ${v}"`;
      });
    }
    if (tc.cookies) {
      const cookieStr = Object.entries(tc.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
      cmd += ` -b "${cookieStr}"`;
    }
    cmd += ` ${tc.url}`;
    navigator.clipboard.writeText(cmd);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const getItemStatus = (id: string): TestItemStatus => {
    if (resultMap.has(id)) return "done";
    if (runningId === id) return "running";
    return "pending";
  };

  const passRate = summary
    ? Math.round((summary.passed / summary.total) * 100)
    : 0;

  return (
    <div className="space-y-2">
      {/* Progress / Summary bar */}
      <div className="rounded-lg border bg-card px-3 py-2.5">
        {loading && progress ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                测试中 {progress.current}/{progress.total}
              </span>
              <span className="text-[10px] text-muted-foreground truncate ml-4 max-w-[200px]">
                {currentTest}
              </span>
            </div>
            <Progress
              value={(progress.current / progress.total) * 100}
              className="h-1"
            />
          </div>
        ) : summary ? (
          <div className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-md shrink-0 ${
                summary.failed === 0
                  ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
              }`}
            >
              {summary.failed === 0 ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">
                {summary.failed === 0
                  ? "全部通过"
                  : `${summary.failed} 项失败`}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {summary.passed}/{summary.total} · {passRate}% · {(summary.duration / 1000).toFixed(1)}s
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5">
                <span className="text-sm font-bold font-mono">{summary.passed}</span>
                <span className="text-[10px]">通过</span>
              </span>
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${
                summary.failed > 0
                  ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                <span className="text-sm font-bold font-mono">{summary.failed}</span>
                <span className="text-[10px]">失败</span>
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Flat results list */}
      <div className="rounded-lg border bg-card">
        {testCases.map((tc, i) => {
          const result = resultMap.get(tc.id);
          const status = getItemStatus(tc.id);
          return (
            <div
              key={tc.id}
              className={`flex items-center gap-2 px-3 py-1.5 transition-colors ${
                i > 0 ? "border-t border-border/50" : ""
              } ${result ? "cursor-pointer hover:bg-muted/40" : ""}`}
              onClick={() => result && setDetailResult(result)}
            >
              <div className="shrink-0">
                {status === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                ) : status === "done" && result?.passed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : status === "done" && !result?.passed ? (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-zinc-200 dark:text-zinc-700" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-[13px] font-medium truncate block ${
                    status === "pending" ? "text-muted-foreground" : ""
                  }`}
                >
                  {tc.name}
                </span>
                {result && !result.passed && result.failureReason && (
                  <p className="text-[10px] text-red-500 truncate">
                    {result.failureReason}
                  </p>
                )}
              </div>
              {result && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusBadge status={result.actualStatus} />
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                    {result.durationMs}ms
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail Dialog */}
      <Dialog
        open={!!detailResult}
        onOpenChange={(open) => !open && setDetailResult(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailResult?.passed ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              {detailResult?.testCase.name}
            </DialogTitle>
          </DialogHeader>
          {detailResult && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {detailResult.testCase.description}
              </p>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                <DetailRow label="URL" mono>
                  {detailResult.testCase.url}
                </DetailRow>
                <DetailRow label="预期状态码">
                  <StatusBadge status={detailResult.testCase.expectedStatus} />
                </DetailRow>
                <DetailRow label="实际状态码">
                  <StatusBadge status={detailResult.actualStatus} />
                </DetailRow>
                {(detailResult.testCase.expectedRedirectUrl ||
                  detailResult.actualRedirectUrl) && (
                  <>
                    <DetailRow label="预期重定向" mono>
                      {detailResult.testCase.expectedRedirectUrl || (
                        <span className="text-muted-foreground italic">无</span>
                      )}
                    </DetailRow>
                    <DetailRow label="实际重定向" mono>
                      {detailResult.actualRedirectUrl || (
                        <span className="text-muted-foreground italic">
                          无 (未返回 Location 头)
                        </span>
                      )}
                    </DetailRow>
                  </>
                )}
                {detailResult.usedNode && (
                  <DetailRow label="代理节点">
                    <span className="text-orange-600">
                      {detailResult.usedNode}
                    </span>
                  </DetailRow>
                )}
                <DetailRow label="耗时">{detailResult.durationMs}ms</DetailRow>
                {!detailResult.passed && detailResult.failureReason && (
                  <DetailRow label="失败原因">
                    <span className="text-red-500">
                      {detailResult.failureReason}
                    </span>
                  </DetailRow>
                )}
              </div>

              {detailResult.responseHeaders &&
                Object.keys(detailResult.responseHeaders).length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                      >
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Response Headers
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="rounded-lg border bg-zinc-950 text-zinc-200 p-3 mt-1 max-h-48 overflow-y-auto font-mono text-xs leading-relaxed">
                        {Object.entries(detailResult.responseHeaders).map(
                          ([k, v]) => (
                            <div key={k}>
                              <span className="text-sky-400">{k}</span>
                              <span className="text-zinc-500">: </span>
                              <span className="text-zinc-300 break-all">
                                {v}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyCurl(detailResult.testCase)}
                >
                  {copiedCurl ? (
                    <Check className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 mr-1" />
                  )}
                  {copiedCurl ? "已复制" : "复制 curl 命令"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: number }) {
  const variant =
    status >= 200 && status < 300
      ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
      : status >= 300 && status < 400
      ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800"
      : status >= 400 && status < 500
      ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
      : status >= 500
      ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
      : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-mono font-semibold ${variant}`}
    >
      {status || "ERR"}
    </span>
  );
}

function DetailRow({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground text-xs w-20 shrink-0 pt-0.5 text-right">
        {label}
      </span>
      <span
        className={`text-sm break-all ${mono ? "font-mono text-[13px]" : ""}`}
      >
        {children}
      </span>
    </div>
  );
}
