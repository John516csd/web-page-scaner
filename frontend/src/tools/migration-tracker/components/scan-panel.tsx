"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScanProgress } from "../hooks/use-scan";
import type { ScanStatus } from "../types";

interface Props {
  scanStatus: ScanStatus;
  scanProgress: number;
  scanning: boolean;
  progress: ScanProgress | null;
  batchDone: boolean;
  hasMore: boolean;
  error: string | null;
  batchSize: number;
  autoRun: boolean;
  onBatchSizeChange: (n: number) => void;
  onAutoRunChange: (v: boolean) => void;
  onStart: () => void;
  onContinue: () => void;
  onStop: () => void;
  totalPages: number;
  scannedPages: number;
}

const BATCH_OPTIONS = [10, 20, 50, 100, 200];

export function ScanPanel({
  scanStatus,
  scanProgress,
  scanning,
  progress,
  batchDone,
  hasMore,
  error,
  batchSize,
  autoRun,
  onBatchSizeChange,
  onAutoRunChange,
  onStart,
  onContinue,
  onStop,
  totalPages,
  scannedPages,
}: Props) {
  const overallPct = totalPages > 0 ? Math.round((scannedPages / totalPages) * 100) : scanProgress;
  const batchPct = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <ScanStatusBadge status={scanStatus} />

        {/* Batch size selector */}
        {!scanning && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">每批</span>
            <Select
              value={String(batchSize)}
              onValueChange={(v) => onBatchSizeChange(Number(v))}
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BATCH_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} 页</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Auto-run toggle */}
        <div className="flex items-center gap-1.5">
          <Switch
            id="auto-run"
            checked={autoRun}
            onCheckedChange={onAutoRunChange}
            disabled={scanning && !autoRun}
          />
          <Label htmlFor="auto-run" className="text-sm cursor-pointer">自动连续扫描</Label>
        </div>

        {/* Action buttons */}
        <div className="ml-auto flex gap-2">
          {scanning ? (
            <Button variant="destructive" size="sm" onClick={onStop}>
              停止
            </Button>
          ) : batchDone && hasMore ? (
            <>
              <Button size="sm" variant="outline" onClick={onContinue}>
                继续下一批
              </Button>
              <Button size="sm" onClick={onStart}>
                重新开始
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onStart}>
              {scanStatus === "done" ? "重新扫描" : scannedPages > 0 ? "继续扫描" : "启动扫描"}
            </Button>
          )}
        </div>
      </div>

      {/* Overall progress */}
      {totalPages > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>总进度</span>
            <span>{scannedPages} / {totalPages} 页（{overallPct}%）</span>
          </div>
          <Progress value={overallPct} className="h-2" />
        </div>
      )}

      {/* Current batch progress */}
      {scanning && progress && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="truncate max-w-xs">{progress.path}</span>
            <span className="shrink-0 ml-2">{progress.current} / {progress.total}</span>
          </div>
          <Progress value={batchPct} className="h-1.5 bg-muted" />
        </div>
      )}

      {/* Status messages */}
      {batchDone && !scanning && !hasMore && (
        <p className="text-sm text-green-600 flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4" />全部扫描完成
        </p>
      )}
      {batchDone && !scanning && hasMore && !autoRun && (
        <p className="text-sm text-muted-foreground">
          本批完成，还有待扫描页面。点击「继续下一批」或开启自动模式。
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

function ScanStatusBadge({ status }: { status: ScanStatus }) {
  const variants: Record<ScanStatus, { label: string; className: string }> = {
    pending: { label: "未扫描", className: "bg-secondary text-secondary-foreground" },
    running: { label: "扫描中", className: "bg-blue-100 text-blue-700" },
    done: { label: "已完成", className: "bg-green-100 text-green-700" },
    error: { label: "出错", className: "bg-red-100 text-red-700" },
  };
  const v = variants[status];
  return <Badge className={v.className}>{v.label}</Badge>;
}
