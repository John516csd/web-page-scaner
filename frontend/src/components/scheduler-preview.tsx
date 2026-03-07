"use client";

import { useMemo } from "react";
import { CronExpressionParser } from "cron-parser";

interface SchedulerPreviewProps {
  cron: string;
  enabled: boolean;
  totalCases?: number;
  filteredCases?: number;
}

export function SchedulerPreview({
  cron,
  enabled,
  totalCases,
  filteredCases,
}: SchedulerPreviewProps) {
  const nextRunTime = useMemo(() => {
    if (!enabled) return null;

    try {
      const interval = CronExpressionParser.parse(cron);
      const next = interval.next().toDate();
      return next.toLocaleString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "long",
      });
    } catch {
      return null;
    }
  }, [cron, enabled]);

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
      <div>
        <p className="text-xs text-muted-foreground mb-1">下次运行</p>
        <p className="text-sm font-medium">
          {nextRunTime || "无法计算（Cron 表达式无效）"}
        </p>
      </div>

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
