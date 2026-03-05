"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "lucide-react";
import type {
  RedirectTestResult,
  TestBatchResult,
  RedirectTestCase,
} from "../types";
import { CATEGORY_LABELS } from "../types";

interface TestResultsProps {
  results: RedirectTestResult[];
  summary: TestBatchResult["summary"] | null;
  loading: boolean;
  currentTest: string | null;
  progress: { current: number; total: number } | null;
}

export function TestResults({
  results,
  summary,
  loading,
  currentTest,
  progress,
}: TestResultsProps) {
  const [detailResult, setDetailResult] = useState<RedirectTestResult | null>(
    null
  );
  const [copiedCurl, setCopiedCurl] = useState(false);

  const groupedResults = useMemo(() => {
    const groups: Record<RedirectTestCase["category"], RedirectTestResult[]> = {
      "viewer-request": [],
      "origin-request": [],
      extra: [],
    };
    results.forEach((r) => {
      groups[r.testCase.category].push(r);
    });
    return groups;
  }, [results]);

  const copyCurl = (tc: RedirectTestCase) => {
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

  if (results.length === 0 && !loading) return null;

  const passRate = summary
    ? Math.round((summary.passed / summary.total) * 100)
    : progress
    ? Math.round(
        (results.filter((r) => r.passed).length / Math.max(results.length, 1)) *
          100
      )
    : 0;

  return (
    <div className="space-y-4">
      {/* Progress / Summary */}
      <Card>
        <CardContent className="pt-5 pb-4">
          {loading && progress ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Running tests... {progress.current}/{progress.total}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {currentTest}
                </span>
              </div>
              <Progress
                value={(progress.current / progress.total) * 100}
                className="h-1.5"
              />
            </div>
          ) : summary ? (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    summary.failed === 0
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {summary.failed === 0 ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <XCircle className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <div className="text-lg font-semibold">
                    {summary.failed === 0
                      ? "All Tests Passed"
                      : `${summary.failed} Test${summary.failed > 1 ? "s" : ""} Failed`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {summary.passed}/{summary.total} passed · {passRate}% ·{" "}
                    {(summary.duration / 1000).toFixed(1)}s
                  </div>
                </div>
              </div>
              <div className="ml-auto flex gap-2">
                <SummaryPill
                  label="Passed"
                  count={summary.passed}
                  variant="success"
                />
                <SummaryPill
                  label="Failed"
                  count={summary.failed}
                  variant="error"
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Results by category */}
      {(["viewer-request", "origin-request", "extra"] as const).map((cat) => {
        const catResults = groupedResults[cat];
        if (catResults.length === 0) return null;
        const catPassed = catResults.filter((r) => r.passed).length;
        return (
          <Collapsible key={cat} defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          cat === "viewer-request"
                            ? "bg-sky-500"
                            : cat === "origin-request"
                            ? "bg-amber-500"
                            : "bg-violet-500"
                        }`}
                      />
                      <CardTitle className="text-sm font-medium">
                        {CATEGORY_LABELS[cat]}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          catPassed === catResults.length
                            ? "border-emerald-300 text-emerald-600"
                            : "border-red-300 text-red-600"
                        }`}
                      >
                        {catPassed}/{catResults.length}
                      </Badge>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-2 pb-2">
                  <div className="space-y-0.5">
                    {catResults.map((result) => (
                      <div
                        key={result.testCase.id}
                        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md hover:bg-muted/40 transition-colors"
                        onClick={() => setDetailResult(result)}
                      >
                        <div className="shrink-0">
                          {result.passed ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] font-medium truncate block">
                            {result.testCase.name}
                          </span>
                          {!result.passed && result.failureReason && (
                            <p className="text-[11px] text-red-500 truncate">
                              {result.failureReason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusBadge status={result.actualStatus} />
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {result.durationMs}ms
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}

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
                {(detailResult.testCase.expectedRedirectUrl || detailResult.actualRedirectUrl) && (
                  <>
                    <DetailRow label="预期重定向" mono>
                      {detailResult.testCase.expectedRedirectUrl || <span className="text-muted-foreground italic">无</span>}
                    </DetailRow>
                    <DetailRow label="实际重定向" mono>
                      {detailResult.actualRedirectUrl || <span className="text-muted-foreground italic">无 (未返回 Location 头)</span>}
                    </DetailRow>
                  </>
                )}
                {detailResult.usedNode && (
                  <DetailRow label="代理节点">
                    <span className="text-orange-600">{detailResult.usedNode}</span>
                  </DetailRow>
                )}
                <DetailRow label="耗时">
                  {detailResult.durationMs}ms
                </DetailRow>
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
                              <span className="text-zinc-300 break-all">{v}</span>
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
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : status >= 300 && status < 400
      ? "bg-blue-100 text-blue-700 border-blue-200"
      : status >= 400 && status < 500
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : status >= 500
      ? "bg-red-100 text-red-700 border-red-200"
      : "bg-zinc-100 text-zinc-700 border-zinc-200";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-mono font-semibold ${variant}`}
    >
      {status || "ERR"}
    </span>
  );
}

function SummaryPill({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: "success" | "error";
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${
        variant === "success"
          ? "bg-emerald-50 text-emerald-700"
          : count > 0
          ? "bg-red-50 text-red-700"
          : "bg-zinc-50 text-zinc-400"
      }`}
    >
      <span className="text-lg font-bold font-mono">{count}</span>
      <span className="text-xs">{label}</span>
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
