"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wifi, WifiOff, Globe, Send, MessageSquare } from "lucide-react";
import { TestCaseEditor } from "@/tools/url-tester/components/test-case-editor";
import { TestResults } from "@/tools/url-tester/components/test-results";
import { CollectionPicker } from "@/tools/url-tester/components/collection-picker";
import { useUrlTester } from "@/tools/url-tester/hooks/use-url-tester";
import { SchedulerPanel } from "@/components/scheduler-panel";
import { apiPost, apiGet, apiPut, apiDelete } from "@/lib/api";
import type { UrlTestCase, TestCollection } from "@/tools/url-tester/types";

interface ProxyStatus {
  ok: boolean;
  mode: "direct" | "proxy";
  ip?: string;
  country?: string;
  city?: string;
  autoSwitch?: boolean;
  error?: string;
}

interface ScheduleData {
  id: string;
  toolId: string;
  cron: string;
  enabled: boolean;
  config: {
    collectionId?: string;
    proxy?: string;
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

export default function UrlTesterPage() {
  const [collections, setCollections] = useState<TestCollection[]>([]);
  const [activeCollection, setActiveCollection] = useState<TestCollection | null>(null);
  const [testCases, setTestCases] = useState<UrlTestCase[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [proxy, setProxy] = useState("http://127.0.0.1:9674");
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [runningCases, setRunningCases] = useState<UrlTestCase[]>([]);

  const [slackConfigured, setSlackConfigured] = useState(false);
  const [notifySlack, setNotifySlack] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [scheduleMap, setScheduleMap] = useState<Record<string, ScheduleData>>({});
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleRunning, setScheduleRunning] = useState(false);

  const tester = useUrlTester();
  const { run, stop, loading, results, summary, currentTest, progress, slackSent } = tester;

  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    apiGet<{ configured: boolean }>("/config/slack")
      .then((res) => setSlackConfigured(res.configured))
      .catch(() => setSlackConfigured(false));

    apiGet<ScheduleData[]>("/tools/url-tester/schedules")
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

    apiGet<TestCollection[]>("/tools/url-tester/collections")
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
  }, []);

  useEffect(() => {
    if (activeCollection) {
      const cached = scheduleMap[activeCollection.id];
      setSchedule(cached || null);
      if (!cached) {
        apiGet<ScheduleData | null>(`/tools/url-tester/collections/${activeCollection.id}/schedule`)
          .then((res) => {
            if (res) {
              setSchedule(res);
              setScheduleMap((prev) => ({ ...prev, [activeCollection.id]: res }));
            }
          })
          .catch(() => {});
      }
    } else {
      setSchedule(null);
    }
  }, [activeCollection, scheduleMap]);

  const handleSelectCollection = useCallback((col: TestCollection) => {
    setActiveCollection(col);
    setTestCases(col.testCases);
    setSelectedIds(new Set(col.testCases.map((tc) => tc.id)));
    setDirty(false);
  }, []);

  const handleTestCasesChange = useCallback((cases: UrlTestCase[]) => {
    setTestCases(cases);
    setDirty(true);
  }, []);

  const handleSaveCollection = useCallback(async () => {
    if (!activeCollection) return;
    setSaving(true);
    try {
      const updated = await apiPut<TestCollection>(
        `/tools/url-tester/collections/${activeCollection.id}`,
        { testCases }
      );
      setActiveCollection(updated);
      setCollections((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setDirty(false);
    } catch (error) {
      console.error("Failed to save collection:", error);
    } finally {
      setSaving(false);
    }
  }, [activeCollection, testCases]);

  const handleCreateCollection = useCallback(async (name: string, description?: string) => {
    const created = await apiPost<TestCollection>("/tools/url-tester/collections", {
      name,
      description,
      testCases: [],
    });
    setCollections((prev) => [...prev, created]);
    handleSelectCollection(created);
  }, [handleSelectCollection]);

  const handleRenameCollection = useCallback(async (id: string, name: string) => {
    const updated = await apiPut<TestCollection>(`/tools/url-tester/collections/${id}`, { name });
    setCollections((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    if (activeCollection?.id === id) {
      setActiveCollection(updated);
    }
  }, [activeCollection]);

  const handleDeleteCollection = useCallback(async (id: string) => {
    await apiDelete(`/tools/url-tester/collections/${id}`);
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
  }, [activeCollection, handleSelectCollection]);

  const handleRun = useCallback(
    async (cases: UrlTestCase[]) => {
      if (proxy) {
        setChecking(true);
        try {
          const status = await apiPost<ProxyStatus>(
            "/tools/url-tester/check-proxy",
            { proxy }
          );
          setProxyStatus(status);
          if (!status.ok) {
            setChecking(false);
            return;
          }
        } catch {
          setProxyStatus({
            ok: false,
            mode: "proxy",
            error: "无法连接后端，请检查服务是否启动",
          });
          setChecking(false);
          return;
        }
        setChecking(false);
      } else {
        setProxyStatus(null);
      }
      setRunningCases(cases);
      run(cases, proxy || undefined, notifySlack, activeCollection?.name);
    },
    [run, proxy, notifySlack, activeCollection]
  );

  const handleSaveSchedule = useCallback(async (cron: string, enabled: boolean) => {
    if (!activeCollection) return;
    setScheduleSaving(true);
    try {
      const updatedSchedule = await apiPut<ScheduleData>(
        `/tools/url-tester/collections/${activeCollection.id}/schedule`,
        {
          cron,
          enabled,
          proxy: proxy || undefined,
          notifySlack: true,
        }
      );
      setSchedule(updatedSchedule);
      setScheduleMap((prev) => ({ ...prev, [activeCollection.id]: updatedSchedule }));
    } catch (error) {
      console.error("Failed to save schedule:", error);
    } finally {
      setScheduleSaving(false);
    }
  }, [proxy, activeCollection]);

  const handleRunScheduleNow = useCallback(async () => {
    if (!activeCollection) return;
    setScheduleRunning(true);
    try {
      await apiPost(`/tools/url-tester/collections/${activeCollection.id}/schedule/run`, {});
    } catch (error) {
      console.error("Failed to run schedule:", error);
    } finally {
      setScheduleRunning(false);
    }
  }, [activeCollection]);

  const handleResetToSaved = useCallback(() => {
    if (activeCollection) {
      setTestCases(activeCollection.testCases);
      setSelectedIds(new Set(activeCollection.testCases.map((tc) => tc.id)));
      setDirty(false);
    }
  }, [activeCollection]);

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight shrink-0">
          URL Tester
        </h1>
        <div className="flex items-center gap-4 divide-x divide-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 pr-2">
                <Label className="text-xs text-muted-foreground shrink-0">
                  请求代理
                </Label>
                <Input
                  value={proxy}
                  onChange={(e) => {
                    setProxy(e.target.value);
                    setProxyStatus(null);
                  }}
                  placeholder="留空则直连"
                  className="font-mono text-xs h-7 w-48"
                />
                {proxy ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-emerald-300 text-emerald-600 px-2 py-0 shrink-0"
                  >
                    代理
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-zinc-300 text-zinc-400 px-2 py-0 shrink-0"
                  >
                    直连
                  </Badge>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              通过 HTTP 代理发送测试请求，用于模拟不同地区访问
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 pl-4">
                <Switch
                  id="slack-notify"
                  checked={notifySlack}
                  onCheckedChange={setNotifySlack}
                  disabled={!slackConfigured}
                />
                <Label
                  htmlFor="slack-notify"
                  className="text-xs text-muted-foreground shrink-0 cursor-pointer"
                >
                  Slack 通知
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {slackConfigured
                ? "测试完成后自动发送报告到 Slack"
                : "请先在 .env 中配置 SLACK_WEBHOOK_URL"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Status alerts */}
      {proxyStatus && !proxyStatus.ok && (
        <Alert variant="destructive" className="py-2">
          <WifiOff className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">
            {proxyStatus.error || "代理连接失败"} — 请开启 VPN 后再运行测试
          </AlertDescription>
        </Alert>
      )}
      {proxyStatus && proxyStatus.ok && proxyStatus.mode === "proxy" && (
        <Alert className="py-2">
          <Wifi className="h-3.5 w-3.5" />
          <AlertDescription className="flex items-center gap-2 text-xs">
            <span>
              代理已连接 — IP: {proxyStatus.ip} ({proxyStatus.city}, {proxyStatus.country})
            </span>
            {proxyStatus.autoSwitch && (
              <Badge
                variant="outline"
                className="text-[10px] border-orange-200 text-orange-600"
              >
                <Globe className="h-2.5 w-2.5 mr-0.5" />
                自动切国家
              </Badge>
            )}
          </AlertDescription>
        </Alert>
      )}
      {slackSent && (
        <Alert className="py-2">
          <Send className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">已发送 Slack 通知</AlertDescription>
        </Alert>
      )}

      {/* Main content: two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: test cases */}
        <div className="rounded-lg border bg-card overflow-hidden flex flex-col max-h-[calc(100vh-160px)]">
          {/* Collection picker header */}
          <div className="border-b px-2 py-1.5">
            <CollectionPicker
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
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <TestCaseEditor
              testCases={testCases}
              onTestCasesChange={handleTestCasesChange}
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
              onRun={handleRun}
              onStop={stop}
              loading={loading || checking}
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
            <TestResults
              testCases={runningCases}
              results={results}
              summary={summary}
              loading={loading}
              currentTest={currentTest}
              progress={progress}
            />
          ) : (
            <div className="rounded-lg border bg-card flex items-center justify-center min-h-[300px]">
              <div className="text-center">
                <div className="mb-2 text-3xl opacity-10 font-mono">{"</>"}</div>
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
          toolId="url-tester"
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
