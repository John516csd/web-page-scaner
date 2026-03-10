"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Send, MessageSquare } from "lucide-react";
import { E2ETestCaseEditor } from "@/tools/e2e-tester/components/test-case-editor";
import { E2ETestResults } from "@/tools/e2e-tester/components/test-results";
import { E2ECollectionPicker } from "@/tools/e2e-tester/components/collection-picker";
import { useE2ETester } from "@/tools/e2e-tester/hooks/use-e2e-tester";
import { SchedulerPanel } from "@/components/scheduler-panel";
import { apiPost, apiGet, apiPut, apiDelete } from "@/lib/api";
import type { E2ETestCase, E2ETestCollection } from "@/tools/e2e-tester/types";

interface ScheduleData {
  id: string;
  toolId: string;
  cron: string;
  enabled: boolean;
  config: {
    collectionId?: string;
    notifySlack?: boolean;
  };
  lastRun?: {
    time: string;
    success: boolean;
    summary?: {
      total: number;
      passed: number;
      failed: number;
      duration: number;
    };
  };
}

export default function E2ETesterPage() {
  const [collections, setCollections] = useState<E2ETestCollection[]>([]);
  const [activeCollection, setActiveCollection] =
    useState<E2ETestCollection | null>(null);
  const [testCases, setTestCases] = useState<E2ETestCase[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningCases, setRunningCases] = useState<E2ETestCase[]>([]);

  const [slackConfigured, setSlackConfigured] = useState(false);
  const [notifySlack, setNotifySlack] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [scheduleMap, setScheduleMap] = useState<
    Record<string, ScheduleData>
  >({});
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleRunning, setScheduleRunning] = useState(false);

  const tester = useE2ETester();
  const {
    run,
    stop,
    loading,
    results,
    summary,
    currentTest,
    progress,
    slackSent,
  } = tester;

  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    apiGet<{ configured: boolean }>("/config/slack")
      .then((res) => setSlackConfigured(res.configured))
      .catch(() => setSlackConfigured(false));

    apiGet<ScheduleData[]>("/tools/e2e-tester/schedules")
      .then((schedules) => {
        const map: Record<string, ScheduleData> = {};
        for (const s of schedules) {
          if (s.config.collectionId) {
            map[s.config.collectionId] = s;
          }
        }
        setScheduleMap(map);
      })
      .catch(() => {});

    apiGet<E2ETestCollection[]>("/tools/e2e-tester/collections")
      .then((cols) => {
        setCollections(cols);
        if (cols.length > 0) {
          const first = cols[0];
          setActiveCollection(first);
          setTestCases(first.testCases);
          setSelectedIds(new Set(first.testCases.map((tc) => tc.id)));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeCollection) {
      const cached = scheduleMap[activeCollection.id];
      setSchedule(cached || null);
      if (!cached) {
        apiGet<ScheduleData | null>(
          `/tools/e2e-tester/collections/${activeCollection.id}/schedule`
        )
          .then((res) => {
            if (res) {
              setSchedule(res);
              setScheduleMap((prev) => ({
                ...prev,
                [activeCollection.id]: res,
              }));
            }
          })
          .catch(() => {});
      }
    } else {
      setSchedule(null);
    }
  }, [activeCollection, scheduleMap]);

  const handleSelectCollection = useCallback((col: E2ETestCollection) => {
    setActiveCollection(col);
    setTestCases(col.testCases);
    setSelectedIds(new Set(col.testCases.map((tc) => tc.id)));
    setDirty(false);
  }, []);

  const handleTestCasesChange = useCallback((cases: E2ETestCase[]) => {
    setTestCases(cases);
    setDirty(true);
  }, []);

  const handleSaveCollection = useCallback(async () => {
    if (!activeCollection) return;
    setSaving(true);
    try {
      const updated = await apiPut<E2ETestCollection>(
        `/tools/e2e-tester/collections/${activeCollection.id}`,
        { testCases }
      );
      setActiveCollection(updated);
      setCollections((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setDirty(false);
    } catch (error) {
      console.error("Failed to save collection:", error);
    } finally {
      setSaving(false);
    }
  }, [activeCollection, testCases]);

  const handleCreateCollection = useCallback(
    async (name: string, description?: string) => {
      const created = await apiPost<E2ETestCollection>(
        "/tools/e2e-tester/collections",
        {
          name,
          description,
          testCases: [],
        }
      );
      setCollections((prev) => [...prev, created]);
      handleSelectCollection(created);
    },
    [handleSelectCollection]
  );

  const handleRenameCollection = useCallback(
    async (id: string, name: string) => {
      const updated = await apiPut<E2ETestCollection>(
        `/tools/e2e-tester/collections/${id}`,
        { name }
      );
      setCollections((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      if (activeCollection?.id === id) {
        setActiveCollection(updated);
      }
    },
    [activeCollection]
  );

  const handleDeleteCollection = useCallback(
    async (id: string) => {
      await apiDelete(`/tools/e2e-tester/collections/${id}`);
      setCollections((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (activeCollection?.id === id) {
          if (next.length > 0) {
            handleSelectCollection(next[0]);
          } else {
            setActiveCollection(null);
            setTestCases([]);
            setSelectedIds(new Set());
            setDirty(false);
          }
        }
        return next;
      });
    },
    [activeCollection, handleSelectCollection]
  );

  const handleRun = useCallback(
    async (cases: E2ETestCase[]) => {
      setRunningCases(cases);
      run(cases, notifySlack, activeCollection?.name);
    },
    [run, notifySlack, activeCollection]
  );

  const handleSaveSchedule = useCallback(
    async (cron: string, enabled: boolean) => {
      if (!activeCollection) return;
      setScheduleSaving(true);
      try {
        const updatedSchedule = await apiPut<ScheduleData>(
          `/tools/e2e-tester/collections/${activeCollection.id}/schedule`,
          {
            cron,
            enabled,
            notifySlack: true,
          }
        );
        setSchedule(updatedSchedule);
        setScheduleMap((prev) => ({
          ...prev,
          [activeCollection.id]: updatedSchedule,
        }));
      } catch (error) {
        console.error("Failed to save schedule:", error);
      } finally {
        setScheduleSaving(false);
      }
    },
    [activeCollection]
  );

  const handleRunScheduleNow = useCallback(async () => {
    if (!activeCollection) return;
    setScheduleRunning(true);
    try {
      await apiPost(
        `/tools/e2e-tester/collections/${activeCollection.id}/schedule/run`,
        {}
      );
    } catch (error) {
      console.error("Failed to run schedule:", error);
    } finally {
      setScheduleRunning(false);
    }
  }, [activeCollection]);

  const handleResetToSaved = useCallback(() => {
    if (activeCollection) {
      setTestCases(activeCollection.testCases);
      setSelectedIds(
        new Set(activeCollection.testCases.map((tc) => tc.id))
      );
      setDirty(false);
    }
  }, [activeCollection]);

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-2.5">
        <h1 className="text-lg font-semibold tracking-tight shrink-0">
          E2E Tester
        </h1>
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <label
                htmlFor="e2e-slack-notify"
                className="flex items-center gap-2 cursor-pointer"
              >
                <MessageSquare
                  className={`h-3.5 w-3.5 shrink-0 ${
                    notifySlack
                      ? "text-emerald-600"
                      : "text-muted-foreground"
                  }`}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Slack 通知
                </span>
                <Switch
                  id="e2e-slack-notify"
                  checked={notifySlack}
                  onCheckedChange={setNotifySlack}
                  disabled={!slackConfigured}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {slackConfigured
                ? "测试完成后自动发送报告到 Slack"
                : "请先在 .env 中配置 SLACK_WEBHOOK_URL"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Alerts */}
      {slackSent && (
        <Alert className="py-2">
          <Send className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">
            已发送 Slack 通知
          </AlertDescription>
        </Alert>
      )}

      {/* Main content: two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left: test cases */}
        <div className="rounded-lg border bg-card overflow-hidden flex flex-col">
          {/* Collection picker header */}
          <div className="border-b px-2 py-1.5">
            <E2ECollectionPicker
              collections={collections}
              activeId={activeCollection?.id || null}
              onSelect={handleSelectCollection}
              onCreate={handleCreateCollection}
              onRename={handleRenameCollection}
              onDelete={handleDeleteCollection}
              disabled={loading}
              scheduleMap={scheduleMap}
            />
          </div>
          <div className="overflow-y-auto px-2 pb-2 max-h-[calc(100vh-240px)]">
            <E2ETestCaseEditor
              testCases={testCases}
              onTestCasesChange={handleTestCasesChange}
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
              onRun={handleRun}
              onStop={stop}
              loading={loading}
              dirty={dirty}
              saving={saving}
              onSave={handleSaveCollection}
              onReset={handleResetToSaved}
            />
          </div>
        </div>

        {/* Right: results */}
        <div className="max-h-[calc(100vh-160px)] overflow-y-auto">
          {results.length > 0 || loading ? (
            <E2ETestResults
              testCases={runningCases}
              results={results}
              summary={summary}
              loading={loading}
              currentTest={currentTest}
              progress={progress}
            />
          ) : (
            <div className="rounded-lg border bg-card flex items-center justify-center min-h-[200px]">
              <div className="text-center">
                <div className="mb-2 text-3xl opacity-10 font-mono">
                  {"</>"}
                </div>
                <p className="text-muted-foreground text-xs">
                  选择用例并点击运行
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Per-collection Scheduler Panel */}
      {activeCollection && (
        <SchedulerPanel
          toolId="e2e-tester"
          config={schedule}
          onSave={handleSaveSchedule}
          onRunNow={handleRunScheduleNow}
          collectionName={activeCollection.name}
          totalCases={testCases.length}
          saving={scheduleSaving}
          running={scheduleRunning}
        />
      )}
    </div>
  );
}
