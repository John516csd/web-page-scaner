"use client";

import { useState, useMemo, Fragment } from "react";
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bug,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  LinkIcon,
  Square,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PageDeadLinkResult } from "../types";
import { DeadLinkResultView } from "./dead-link-result";

export function SiteDeadLinkBatchResult({
  results,
  totalPages,
  currentBatch,
  hasMore,
  loading,
  onContinue,
  onStop,
  autoRun,
}: {
  results: PageDeadLinkResult[];
  totalPages: number;
  currentBatch: { current: number; total: number; path: string } | null;
  hasMore: boolean;
  loading: boolean;
  onContinue: () => void;
  onStop: () => void;
  autoRun?: boolean;
}) {
  const [selectedItem, setSelectedItem] = useState<PageDeadLinkResult | null>(
    null
  );
  const [showDeadSummary, setShowDeadSummary] = useState(true);
  const [expandedDeadLink, setExpandedDeadLink] = useState<string | null>(null);

  const deadLinkSummary = useMemo(() => {
    const map = new Map<string, { url: string; statusCode: number | null; pages: string[] }>();
    for (const r of results) {
      if (!r.result) continue;
      for (const link of r.result.links) {
        if (link.status !== "dead") continue;
        const existing = map.get(link.url);
        if (existing) {
          if (!existing.pages.includes(r.path)) existing.pages.push(r.path);
        } else {
          map.set(link.url, { url: link.url, statusCode: link.statusCode, pages: [r.path] });
        }
      }
    }
    return Array.from(map.values());
  }, [results]);

  const passCount = results.filter((r) => r.status === "pass").length;
  const warnCount = results.filter((r) => r.status === "warn").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const totalDead = results.reduce((sum, r) => sum + r.deadCount, 0);

  const progressPct =
    totalPages > 0 ? Math.round((results.length / totalPages) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>
              总进度: {results.length} / {totalPages} 页面
            </span>
            <span className="text-muted-foreground">{progressPct}%</span>
          </div>
          <Progress value={progressPct} />

          <div className="flex gap-3 text-sm flex-wrap items-center">
            {results.length > 0 && (
              <>
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {passCount} 通过
                </div>
                {warnCount > 0 && (
                  <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {warnCount} 警告
                  </div>
                )}
                {failCount > 0 && (
                  <div className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    {failCount} 失败
                  </div>
                )}
                {errorCount > 0 && (
                  <div className="flex items-center gap-1 text-destructive">
                    <Bug className="h-3.5 w-3.5" />
                    {errorCount} 错误
                  </div>
                )}
                {totalDead > 0 && (
                  <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    共发现 <span className="font-semibold">{totalDead}</span>{" "}
                    个死链
                  </div>
                )}
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              {loading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onStop}
                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                >
                  <Square className="h-3.5 w-3.5 mr-1 fill-current" />
                  停止
                </Button>
              )}
              {!loading && hasMore && !autoRun && (
                <Button size="sm" onClick={onContinue}>
                  继续下一批
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {loading && currentBatch && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              正在检查 ({currentBatch.current}/{currentBatch.total}):{" "}
              {currentBatch.path}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Page results */}
        <div className="lg:col-span-3 max-h-[calc(100vh-280px)] overflow-y-auto">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 pl-6">#</TableHead>
                  <TableHead>路径</TableHead>
                  <TableHead className="w-20">状态</TableHead>
                  <TableHead className="w-16 text-center">死链</TableHead>
                  <TableHead className="w-16 text-center">总链接</TableHead>
                  <TableHead className="w-16">耗时</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, i) => {
                  const rowClass = {
                    pass: "",
                    warn: "bg-amber-50/60 dark:bg-amber-950/20",
                    fail: "bg-red-50/60 dark:bg-red-950/20",
                    error: "bg-red-50/60 dark:bg-red-950/20",
                  }[r.status];
                  return (
                    <TableRow
                      key={r.path}
                      className={cn("cursor-pointer hover:bg-muted/50", rowClass)}
                      onClick={() => setSelectedItem(r)}
                    >
                      <TableCell className="pl-6 text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.path}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        {r.deadCount > 0 ? (
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {r.deadCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {r.totalLinks}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {(r.duration / 1000).toFixed(1)}s
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Right: Dead link summary */}
        <div className="lg:col-span-2 max-h-[calc(100vh-280px)] overflow-y-auto">
          <Card className="h-full">
            <CardContent className="pt-5 pb-0">
              <div className="flex items-center gap-2 pb-3">
                <LinkIcon className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">死链汇总（去重）</span>
                <Badge variant="destructive" className="text-xs">
                  {deadLinkSummary.length}
                </Badge>
              </div>
            </CardContent>
            {deadLinkSummary.length > 0 ? (
              <div className="w-full overflow-hidden">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">URL</TableHead>
                      <TableHead className="w-16">状态码</TableHead>
                      <TableHead className="w-20 text-center">页面数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deadLinkSummary.map((item) => (
                      <Fragment key={item.url}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            setExpandedDeadLink(
                              expandedDeadLink === item.url ? null : item.url
                            )
                          }
                        >
                          <TableCell className="pl-6 py-2.5">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline break-all line-clamp-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {item.url}
                            </a>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="destructive">
                              {item.statusCode ?? "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            <span className="text-sm">
                              {item.pages.length} 个
                              {expandedDeadLink === item.url ? (
                                <ChevronUp className="inline h-3 w-3 ml-1" />
                              ) : (
                                <ChevronDown className="inline h-3 w-3 ml-1" />
                              )}
                            </span>
                          </TableCell>
                        </TableRow>
                        {expandedDeadLink === item.url && (
                          <TableRow>
                            <TableCell colSpan={3} className="pl-10 py-2 bg-muted/30">
                              <div className="flex flex-wrap gap-1.5">
                                {item.pages.map((page) => (
                                  <Badge
                                    key={page}
                                    variant="secondary"
                                    className="font-mono text-xs"
                                  >
                                    {page}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <CardContent className="pt-0 pb-6">
                <p className="text-sm text-muted-foreground text-center py-8">
                  暂未发现死链
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <Dialog
        open={!!selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      >
        <DialogContent className="max-w-[90vw] sm:max-w-[90vw] w-full max-h-[90vh] flex flex-col overflow-hidden p-0">
          {selectedItem && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                <div className="flex items-center gap-3">
                  <DialogTitle className="font-mono text-sm">
                    {selectedItem.path}
                  </DialogTitle>
                  <StatusBadge status={selectedItem.status} />
                  <span className="text-sm text-muted-foreground">
                    {(selectedItem.duration / 1000).toFixed(1)}s
                  </span>
                </div>
                {selectedItem.result && (
                  <DialogDescription className="text-xs">
                    {selectedItem.result.pageUrl}
                  </DialogDescription>
                )}
                {selectedItem.error && !selectedItem.result && (
                  <DialogDescription className="sr-only">
                    错误详情
                  </DialogDescription>
                )}
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {selectedItem.result ? (
                  <DeadLinkResultView result={selectedItem.result} />
                ) : selectedItem.error ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                    <AlertOctagon className="h-12 w-12 text-destructive/60" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">检查过程中发生错误</p>
                      <p className="text-sm text-muted-foreground max-w-md">
                        {selectedItem.error}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    暂无检查数据
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: PageDeadLinkResult["status"];
}) {
  const config = {
    pass: {
      label: "通过",
      icon: CheckCircle2,
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    },
    warn: {
      label: "警告",
      icon: AlertTriangle,
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    },
    fail: {
      label: "失败",
      icon: XCircle,
      className:
        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    },
    error: {
      label: "错误",
      icon: Bug,
      className:
        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    },
  };

  const { label, icon: Icon, className } = config[status];

  return (
    <Badge variant="outline" className={cn("border-transparent", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
