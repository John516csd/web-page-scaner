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
  Loader2,
  Circle,
  Image as ImageIcon,
  Terminal,
} from "lucide-react";
import type { E2ETestResult, E2EBatchResult, E2ETestCase } from "../types";

type TestItemStatus = "pending" | "running" | "done";

interface E2ETestResultsProps {
  testCases: E2ETestCase[];
  results: E2ETestResult[];
  summary: E2EBatchResult["summary"] | null;
  loading: boolean;
  currentTest: string | null;
  progress: { current: number; total: number } | null;
}

export function E2ETestResults({
  testCases,
  results,
  summary,
  loading,
  currentTest,
  progress,
}: E2ETestResultsProps) {
  const [detailResult, setDetailResult] = useState<E2ETestResult | null>(null);

  const resultMap = useMemo(() => {
    const map = new Map<string, E2ETestResult>();
    results.forEach((r) => map.set(r.testCase.id, r));
    return map;
  }, [results]);

  const runningId = useMemo(() => {
    if (!currentTest || !loading) return null;
    const tc = testCases.find((t) => currentTest.includes(t.name));
    return tc?.id ?? null;
  }, [currentTest, loading, testCases]);

  const getItemStatus = (id: string): TestItemStatus => {
    if (resultMap.has(id)) return "done";
    if (runningId === id) return "running";
    return "pending";
  };

  const passRate = summary
    ? Math.round((summary.passed / summary.total) * 100)
    : 0;

  return (
    <div>
      {/* Progress / Summary bar */}
      <div className="rounded-lg border bg-card px-3 py-2.5 sticky top-0 z-10 mb-2">
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
                {summary.passed}/{summary.total} · {passRate}% ·{" "}
                {(summary.duration / 1000).toFixed(1)}s
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5">
                <span className="text-sm font-bold font-mono">
                  {summary.passed}
                </span>
                <span className="text-[10px]">通过</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${
                  summary.failed > 0
                    ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <span className="text-sm font-bold font-mono">
                  {summary.failed}
                </span>
                <span className="text-[10px]">失败</span>
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Flat results list */}
      <div className="rounded-lg border bg-card mt-2">
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
                {result && !result.passed && result.error && (
                  <p className="text-[10px] text-red-500 truncate">
                    {result.error}
                  </p>
                )}
              </div>
              {result && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
                      result.passed
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                        : "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                    }`}
                  >
                    {result.passed ? "PASS" : "FAIL"}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                    {result.durationMs >= 1000
                      ? `${(result.durationMs / 1000).toFixed(1)}s`
                      : `${result.durationMs}ms`}
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
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
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
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                <DetailRow label="URL" mono>
                  {detailResult.testCase.url}
                </DetailRow>
                <DetailRow label="状态">
                  <span
                    className={
                      detailResult.passed
                        ? "text-emerald-600 font-medium"
                        : "text-red-600 font-medium"
                    }
                  >
                    {detailResult.passed ? "通过" : "失败"}
                  </span>
                </DetailRow>
                <DetailRow label="耗时">
                  {detailResult.durationMs >= 1000
                    ? `${(detailResult.durationMs / 1000).toFixed(1)}s`
                    : `${detailResult.durationMs}ms`}
                </DetailRow>
                {detailResult.error && (
                  <DetailRow label="错误">
                    <span className="text-red-500">{detailResult.error}</span>
                  </DetailRow>
                )}
              </div>

              {/* Screenshot */}
              {detailResult.screenshot && (
                <Collapsible defaultOpen>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                    >
                      <ImageIcon className="h-3 w-3 mr-1" />
                      <ChevronDown className="h-3 w-3 mr-1" />
                      失败截图
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="rounded-lg border overflow-hidden mt-1">
                      <img
                        src={`data:image/png;base64,${detailResult.screenshot}`}
                        alt="Failure screenshot"
                        className="w-full"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Console logs */}
              {detailResult.consoleLogs &&
                detailResult.consoleLogs.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                      >
                        <Terminal className="h-3 w-3 mr-1" />
                        <ChevronDown className="h-3 w-3 mr-1" />
                        控制台日志 ({detailResult.consoleLogs.length})
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="rounded-lg border bg-zinc-950 text-zinc-200 p-3 mt-1 max-h-48 overflow-y-auto font-mono text-xs leading-relaxed">
                        {detailResult.consoleLogs.map((log, i) => (
                          <div key={i} className="break-all">
                            {log}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
      <span className="text-muted-foreground text-xs w-12 shrink-0 pt-0.5 text-right">
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
