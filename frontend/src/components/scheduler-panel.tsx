"use client";

import { useState, useCallback, useEffect, ReactNode } from "react";
import { Clock, Play, Save, CalendarClock, History, Filter, Timer } from "lucide-react";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./ui/drawer";
import { SchedulerCronInput } from "./scheduler-cron-input";
import { SchedulerPreview } from "./scheduler-preview";

export interface ScheduleConfig<T = unknown> {
  cron: string;
  enabled: boolean;
  lastRun?: {
    time: string;
    success: boolean;
    summary?: T;
  };
}

interface SchedulerPanelProps<T = unknown> {
  toolId: string;
  config: ScheduleConfig<T> | null;
  onSave: (cron: string, enabled: boolean) => Promise<void>;
  onRunNow: () => Promise<void>;

  collectionName?: string;
  filterSection?: ReactNode;
  totalCases?: number;
  filteredCases?: number;
  renderSummary?: (summary: T) => ReactNode;

  saving?: boolean;
  running?: boolean;
}

export function SchedulerPanel<T = unknown>({
  config,
  onSave,
  onRunNow,
  collectionName,
  filterSection,
  totalCases,
  filteredCases,
  renderSummary,
  saving = false,
  running = false,
}: SchedulerPanelProps<T>) {
  const [localCron, setLocalCron] = useState(config?.cron || "0 9 * * 1-5");
  const [localEnabled, setLocalEnabled] = useState(config?.enabled || false);

  useEffect(() => {
    if (config) {
      setLocalCron(config.cron);
      setLocalEnabled(config.enabled);
    } else {
      setLocalCron("0 9 * * 1-5");
      setLocalEnabled(false);
    }
  }, [config]);

  const handleSave = useCallback(async () => {
    await onSave(localCron, localEnabled);
  }, [localCron, localEnabled, onSave]);

  const hasChanges = !config || config.cron !== localCron || config.enabled !== localEnabled;

  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <button
          className={`fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 ${
            config?.enabled
              ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25"
              : "bg-primary hover:bg-primary/90 shadow-primary/25"
          }`}
          title="定时任务"
        >
          <Clock className="h-5 w-5 text-primary-foreground" />
          {config?.enabled && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-background" />
          )}
        </button>
      </DrawerTrigger>

      <DrawerContent className="h-full max-h-screen">
        <div className="flex flex-col h-full">
          <DrawerHeader className="border-b px-6 py-4 shrink-0 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0">
                  <CalendarClock className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <DrawerTitle className="text-base">定时任务</DrawerTitle>
                  <DrawerDescription className="text-xs truncate">
                    {collectionName ? `集合：${collectionName}` : "配置自动化运行计划"}
                  </DrawerDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {config?.enabled && (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-xs shrink-0">
                    运行中
                  </Badge>
                )}
                <Switch
                  id="schedule-enabled"
                  checked={localEnabled}
                  onCheckedChange={setLocalEnabled}
                  disabled={saving}
                />
                <Label
                  htmlFor="schedule-enabled"
                  className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap"
                >
                  {localEnabled ? "已启用" : "未启用"}
                </Label>
              </div>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Section: Cron */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">运行频率</h3>
              </div>
              <SchedulerCronInput
                value={localCron}
                onChange={setLocalCron}
                disabled={saving}
              />
            </section>

            {/* Section: Filter */}
            {filterSection && (
              <>
                <Separator />
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">筛选用例</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    定时任务将只运行勾选的类别，留空则运行全部
                  </p>
                  {filterSection}
                </section>
              </>
            )}

            {/* Section: Preview */}
            <Separator />
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">执行预览</h3>
              </div>
              <SchedulerPreview
                cron={localCron}
                enabled={localEnabled}
                totalCases={totalCases}
                filteredCases={filteredCases}
              />
            </section>

            {/* Section: Last Run */}
            {config?.lastRun && (
              <>
                <Separator />
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">上次运行</h3>
                  </div>
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">时间</span>
                      <span className="font-medium text-xs">
                        {new Date(config.lastRun.time).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    {renderSummary && config.lastRun.summary ? (
                      renderSummary(config.lastRun.summary)
                    ) : (
                      config.lastRun.summary && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">结果</span>
                          <span className="text-xs">
                            <span className={config.lastRun.success ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                              {config.lastRun.success ? "成功" : "失败"}
                            </span>
                            {" — "}
                            {(config.lastRun.summary as any).passed || 0}/
                            {(config.lastRun.summary as any).total || 0} 通过
                            {(config.lastRun.summary as any).failed > 0 &&
                              ` (${(config.lastRun.summary as any).failed} 失败)`}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </section>
              </>
            )}
          </div>

          <DrawerFooter className="border-t px-6 py-4 shrink-0">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex-1"
                size="sm"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {saving ? "保存中..." : hasChanges ? "保存配置" : "已保存"}
              </Button>
              <Button
                onClick={onRunNow}
                variant="outline"
                size="sm"
                disabled={!config || running}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                {running ? "运行中..." : "立即运行"}
              </Button>
            </div>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
