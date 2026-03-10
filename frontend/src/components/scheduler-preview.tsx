"use client";

import { useMemo, useState, useEffect } from "react";
import { CronExpressionParser } from "cron-parser";

interface SchedulerPreviewProps {
  cron: string;
  enabled: boolean;
  totalCases?: number;
  filteredCases?: number;
}

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return "即将执行...";

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} 小时`);
  if (minutes > 0) parts.push(`${minutes} 分钟`);
  parts.push(`${seconds} 秒`);

  return parts.join(" ");
}

function getNextRunDate(cron: string): Date | null {
  try {
    const interval = CronExpressionParser.parse(cron);
    return interval.next().toDate();
  } catch {
    return null;
  }
}

export function SchedulerPreview({
  cron,
  enabled,
  totalCases,
  filteredCases,
}: SchedulerPreviewProps) {
  const [now, setNow] = useState(() => Date.now());

  const nextRun = useMemo(() => {
    if (!enabled) return null;
    return getNextRunDate(cron);
  }, [cron, enabled]);

  useEffect(() => {
    if (!enabled || !nextRun) return;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, nextRun]);

  const countdown = useMemo(() => {
    if (!nextRun) return null;
    const diff = nextRun.getTime() - now;
    if (diff <= 0) return null;
    return formatCountdown(diff);
  }, [nextRun, now]);

  const nextRunFormatted = useMemo(() => {
    if (!nextRun) return null;
    return nextRun.toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
  }, [nextRun]);

  const casesText = useMemo(() => {
    if (filteredCases !== undefined && filteredCases > 0) {
      return `${filteredCases} 个用例`;
    }
    if (totalCases !== undefined && totalCases > 0) {
      return `全部 ${totalCases} 个用例`;
    }
    return "未配置用例";
  }, [totalCases, filteredCases]);

  if (!enabled) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/20 bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground text-center">
          定时任务未启用
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2.5">
      {countdown ? (
        <div>
          <p className="text-xs text-muted-foreground mb-1">距离下次执行还有</p>
          <p className="text-sm font-semibold font-mono tabular-nums tracking-tight">
            {countdown}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {nextRunFormatted}
          </p>
        </div>
      ) : (
        <div>
          <p className="text-xs text-muted-foreground mb-1">下次运行</p>
          <p className="text-sm font-medium">
            {nextRunFormatted || "无法计算（Cron 表达式无效）"}
          </p>
        </div>
      )}

      {(totalCases !== undefined || filteredCases !== undefined) && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-1">执行范围</p>
          <p className="text-sm font-medium">
            将运行 {casesText}
          </p>
        </div>
      )}
    </div>
  );
}
