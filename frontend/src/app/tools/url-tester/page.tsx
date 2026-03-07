"use client";

import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wifi, WifiOff, Globe, Send } from "lucide-react";
import { TestCaseEditor } from "@/tools/url-tester/components/test-case-editor";
import { TestResults } from "@/tools/url-tester/components/test-results";
import { useUrlTester } from "@/tools/url-tester/hooks/use-url-tester";
import { SchedulerPanel } from "@/components/scheduler-panel";
import { apiPost, apiGet, apiPut } from "@/lib/api";
import {
  DEFAULT_TEST_CASES,
  type UrlTestCase,
} from "@/tools/url-tester/types";

interface ProxyStatus {
  ok: boolean;
  mode: "direct" | "proxy";
  ip?: string;
  country?: string;
  city?: string;
  autoSwitch?: boolean;
  error?: string;
}

interface ScheduleConfig {
  id: string;
  toolId: string;
  cron: string;
  enabled: boolean;
  config: {
    caseIds?: string[];
    proxy?: string;
    notifySlack?: boolean;
    testCases?: UrlTestCase[];
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
  const [testCases, setTestCases] =
    useState<UrlTestCase[]>(DEFAULT_TEST_CASES);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(DEFAULT_TEST_CASES.map((tc) => tc.id))
  );
  const [proxy, setProxy] = useState("http://127.0.0.1:9674");
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [runningCases, setRunningCases] = useState<UrlTestCase[]>([]);

  const [slackConfigured, setSlackConfigured] = useState(false);
  const [notifySlack, setNotifySlack] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleRunning, setScheduleRunning] = useState(false);

  const tester = useUrlTester();
  const { run, stop, loading, results, summary, currentTest, progress, slackSent } =
    tester;

  useEffect(() => {
    apiGet<{ configured: boolean }>("/config/slack").then((res) => {
      setSlackConfigured(res.configured);
    }).catch(() => {
      setSlackConfigured(false);
    });

    apiGet<ScheduleConfig | null>("/tools/url-tester/schedule").then((res) => {
      if (res) {
        setSchedule(res);
      }
    }).catch(() => {});
  }, []);

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
      run(cases, proxy || undefined, notifySlack);
    },
    [run, proxy, notifySlack]
  );

  const handleSaveSchedule = useCallback(async (cron: string, enabled: boolean) => {
    setScheduleSaving(true);
    try {
      const updatedSchedule = await apiPut<ScheduleConfig>("/tools/url-tester/schedule", {
        cron,
        enabled,
        proxy: proxy || undefined,
        notifySlack: true,
        testCases: DEFAULT_TEST_CASES,
      });
      setSchedule(updatedSchedule);
    } catch (error) {
      console.error("Failed to save schedule:", error);
    } finally {
      setScheduleSaving(false);
    }
  }, [proxy]);

  const handleRunScheduleNow = useCallback(async () => {
    setScheduleRunning(true);
    try {
      await apiPost("/tools/url-tester/schedule/run", {});
    } catch (error) {
      console.error("Failed to run schedule:", error);
    } finally {
      setScheduleRunning(false);
    }
  }, []);

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight shrink-0">
          URL Tester
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Input
              value={proxy}
              onChange={(e) => {
                setProxy(e.target.value);
                setProxyStatus(null);
              }}
              placeholder="代理地址（留空直连）"
              className="font-mono text-xs h-7 w-52"
            />
            {proxy ? (
              <Badge
                variant="outline"
                className="text-[10px] border-emerald-300 text-emerald-600 px-1.5 py-0 shrink-0"
              >
                代理
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] border-zinc-300 text-zinc-400 px-1.5 py-0 shrink-0"
              >
                直连
              </Badge>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
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
                  Slack
                </Label>
              </div>
            </TooltipTrigger>
            {!slackConfigured && (
              <TooltipContent>
                请先在 .env 中配置 SLACK_WEBHOOK_URL
              </TooltipContent>
            )}
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
          <div className="flex-1 overflow-y-auto p-2">
            <TestCaseEditor
              testCases={testCases}
              onTestCasesChange={setTestCases}
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
              onRun={handleRun}
              onStop={stop}
              loading={loading || checking}
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

      {/* Floating Scheduler Panel */}
      <SchedulerPanel
        toolId="url-tester"
        config={schedule}
        onSave={handleSaveSchedule}
        onRunNow={handleRunScheduleNow}
        totalCases={DEFAULT_TEST_CASES.length}
        saving={scheduleSaving}
        running={scheduleRunning}
      />
    </div>
  );
}
