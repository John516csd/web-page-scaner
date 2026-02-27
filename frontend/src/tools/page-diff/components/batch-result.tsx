"use client";

import { useState } from "react";
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bug,
  AlertOctagon,
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
import type { PageResult } from "../types";
import { DiffResultView } from "./diff-result";

export function BatchResult({
  results,
  totalPages,
  currentBatch,
  hasMore,
  loading,
  onContinue,
}: {
  results: PageResult[];
  totalPages: number;
  currentBatch: { current: number; total: number; path: string } | null;
  hasMore: boolean;
  loading: boolean;
  onContinue: () => void;
}) {
  const [selectedItem, setSelectedItem] = useState<PageResult | null>(null);

  const passCount = results.filter((r) => r.status === "pass").length;
  const warnCount = results.filter((r) => r.status === "warn").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const errorCount = results.filter((r) => r.status === "error").length;

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

          {results.length > 0 && (
            <div className="flex gap-3 text-sm">
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
            </div>
          )}
        </CardContent>
      </Card>

      {currentBatch && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          正在对比 ({currentBatch.current}/{currentBatch.total}):{" "}
          {currentBatch.path}
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 pl-6">#</TableHead>
              <TableHead>路径</TableHead>
              <TableHead className="w-20">状态</TableHead>
              <TableHead className="w-20">耗时</TableHead>
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
                <TableCell className="text-muted-foreground">
                  {(r.duration / 1000).toFixed(1)}s
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {!loading && hasMore && (
        <div className="flex justify-center">
          <Button onClick={onContinue}>
            继续下一批
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

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
                  <DialogDescription className="text-xs space-x-3">
                    <span>基准: {selectedItem.result.urlA}</span>
                    <span>对比: {selectedItem.result.urlB}</span>
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
                  <DiffResultView result={selectedItem.result} />
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
                    暂无对比数据
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

function StatusBadge({ status }: { status: PageResult["status"] }) {
  const config = {
    pass: {
      label: "通过",
      icon: CheckCircle2,
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    },
    warn: {
      label: "警告",
      icon: AlertTriangle,
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    },
    fail: {
      label: "失败",
      icon: XCircle,
      className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    },
    error: {
      label: "错误",
      icon: Bug,
      className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
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
