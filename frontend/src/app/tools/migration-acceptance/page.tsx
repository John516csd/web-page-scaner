"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Download,
  FileJson,
  FileText,
  Loader2,
  Play,
  ShieldCheck,
  Square,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMigrationAcceptance } from "@/tools/migration-acceptance/hooks/use-migration-acceptance";
import type {
  AcceptanceEnv,
  AcceptanceItem,
  AcceptanceResult,
  AcceptanceSection,
  AcceptanceStatus,
  AcceptanceSuite,
} from "@/tools/migration-acceptance/types";

const DEFAULT_BASE_URL = "https://d214wtvqj6ho8d.cloudfront.net";
const DEFAULT_GATSBY_URL = "https://www.notta.ai";
const DETAIL_TEXT_CLASS = "min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]";
const INLINE_TEXT_CLASS = "min-w-0 max-w-full break-words [overflow-wrap:anywhere]";

const DEFAULT_SUITES: Array<{
  id: AcceptanceSuite;
  label: string;
  detail: string;
}> = [
  { id: "smoke", label: "Smoke", detail: "核心页面与 CMS 样本 200" },
  { id: "routing", label: "Routing", detail: "301、410、404、noindex" },
  { id: "seo-geo", label: "SEO/GEO", detail: "robots、sitemap、llms、head parity" },
  { id: "assets", label: "Assets", detail: "静态资源状态、MIME、console error" },
  { id: "page-parity", label: "Page Parity", detail: "Gatsby 与 Next 页面差异" },
  { id: "cms-storyblok", label: "CMS", detail: "博客、landing、features 等样本" },
  { id: "i18n", label: "I18N", detail: "19 种语言样本与 hreflang/canonical" },
  { id: "functional-e2e", label: "Functional E2E", detail: "复用 E2E Tester 真实流程用例" },
  { id: "visual-responsive", label: "Visual", detail: "桌面/移动截图与横向滚动" },
  { id: "analytics", label: "Analytics", detail: "GTM/GA/PostHog 前端信号" },
  { id: "performance", label: "Performance", detail: "核心页面性能时序" },
];

const SUITE_LABELS = new Map(DEFAULT_SUITES.map((suite) => [suite.id, suite.label]));

export default function MigrationAcceptancePage() {
  const acceptance = useMigrationAcceptance();
  const [env, setEnv] = useState<AcceptanceEnv>("test");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [gatsbyUrl, setGatsbyUrl] = useState(DEFAULT_GATSBY_URL);
  const [exactRedirects, setExactRedirects] = useState("30");
  const [goneUrls, setGoneUrls] = useState("30");
  const [noindex, setNoindex] = useState("30");
  const [notifySlack, setNotifySlack] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expandedBlocker, setExpandedBlocker] = useState<string | null>(null);

  const visibleSections = acceptance.result?.sections || acceptance.sections;
  const summary = acceptance.result?.summary;
  const blockers = acceptance.result?.goNoGo?.blockers || [];
  const progressValue = useMemo(() => {
    if (!acceptance.loading) return summary ? 100 : 0;
    return Math.min(95, Math.round((visibleSections.length / DEFAULT_SUITES.length) * 100));
  }, [acceptance.loading, summary, visibleSections.length]);

  const currentSuiteLabel = acceptance.currentSuite
    ? SUITE_LABELS.get(acceptance.currentSuite as AcceptanceSuite) || acceptance.currentSuite
    : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    acceptance.run({
      env,
      baseUrl: baseUrl.trim(),
      gatsbyUrl: gatsbyUrl.trim() || DEFAULT_GATSBY_URL,
      notifySlack,
      sampleSize: {
        exactRedirects: toOptionalNumber(exactRedirects),
        goneUrls: toOptionalNumber(goneUrls),
        noindex: toOptionalNumber(noindex),
      },
    });
  };

  const scrollToSuite = (suite: AcceptanceSuite) => {
    const target = document.getElementById(sectionDomId(suite)) || document.getElementById("results-start");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-w-0 overflow-x-clip space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Migration Acceptance
          </h1>
          <p className="text-sm text-muted-foreground">
            Gatsby → Next.js 迁移自动化验收
          </p>
        </div>
        {acceptance.loading && (
          <Button variant="outline" size="sm" onClick={acceptance.stop}>
            <Square className="mr-2 h-4 w-4" />
            停止
          </Button>
        )}
      </div>

      {acceptance.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{acceptance.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:pr-1">
          <Card className="min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">运行配置</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>环境</Label>
                  <Select value={env} onValueChange={(value) => setEnv(value as AcceptanceEnv)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="test">test</SelectItem>
                      <SelectItem value="production">production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <LabeledInput label="Next Base URL" value={baseUrl} onChange={setBaseUrl} />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={acceptance.loading || !baseUrl.trim()}
                >
                  {acceptance.loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  开始迁移验收
                </Button>

                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" className="w-full justify-between px-2">
                      高级设置
                      <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <LabeledInput label="Gatsby URL" value={gatsbyUrl} onChange={setGatsbyUrl} />
                    <div className="grid grid-cols-3 gap-2">
                      <LabeledInput label="301" value={exactRedirects} onChange={setExactRedirects} type="number" />
                      <LabeledInput label="410" value={goneUrls} onChange={setGoneUrls} type="number" />
                      <LabeledInput label="noindex" value={noindex} onChange={setNoindex} type="number" />
                    </div>
                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                      <Label htmlFor="notify-slack" className="text-sm">Slack 通知</Label>
                      <Switch id="notify-slack" checked={notifySlack} onCheckedChange={setNotifySlack} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </form>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">本次将执行</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {DEFAULT_SUITES.map((suite) => {
                const section = visibleSections.find((item) => item.suite === suite.id);
                const isCurrent = acceptance.currentSuite === suite.id;
                return (
                  <button
                    key={suite.id}
                    type="button"
                    onClick={() => scrollToSuite(suite.id)}
                    className="flex w-full min-w-0 items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <StatusIcon status={isCurrent ? "pending" : section?.status || "pending"} spinning={isCurrent} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{suite.label}</span>
                        {section && <Badge variant={section.status === "fail" ? "destructive" : "secondary"}>{section.status}</Badge>}
                      </div>
                      <div className="break-words text-xs text-muted-foreground">{suite.detail}</div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <RunOverview
            loading={acceptance.loading}
            currentSuiteLabel={currentSuiteLabel}
            progressValue={progressValue}
            summary={summary}
            blockerCount={blockers.length}
            slackSent={acceptance.slackSent}
          />

          <BlockingList items={blockers} expandedKey={expandedBlocker} onToggle={setExpandedBlocker} />
          <div id="results-start" className="scroll-mt-4">
            <SectionResults sections={visibleSections} />
          </div>
          <ReportExport result={acceptance.result} />
        </div>
      </div>
    </div>
  );
}

function RunOverview({
  loading,
  currentSuiteLabel,
  progressValue,
  summary,
  blockerCount,
  slackSent,
}: {
  loading: boolean;
  currentSuiteLabel: string | null;
  progressValue: number;
  summary?: { total: number; passed: number; failed: number; warned: number; blocked?: number; duration: number };
  blockerCount: number;
  slackSent: boolean;
}) {
  const status: AcceptanceStatus = summary
    ? summary.failed > 0 ? "fail" : summary.warned > 0 ? "warn" : "pass"
    : loading ? "pending" : "manual";

  return (
    <Card className="min-w-0">
      <CardContent className="p-4">
        <div className="grid min-w-0 gap-3 md:grid-cols-3">
          <SummaryTile label="状态" value={summary ? (summary.failed > 0 ? "NO-GO" : "GO") : loading ? "RUNNING" : "READY"} status={status} />
          <SummaryTile label="自动化通过" value={summary ? `${summary.passed}/${summary.total}` : "-"} status={status} />
          <SummaryTile label="P0/P1 阻塞" value={String(blockerCount)} status={blockerCount > 0 ? "fail" : summary ? "pass" : "manual"} />
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  <span className="truncate">正在执行：{currentSuiteLabel || "准备中"}</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">{progressValue}%</span>
              </div>
              <Progress value={progressValue} className="h-1.5" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusIcon status={status} />
              <span>{summary ? `${summary.failed} fail · ${summary.warned} warn · ${(summary.duration / 1000).toFixed(1)}s` : "等待运行"}</span>
              {slackSent && <Badge variant="secondary">Slack 已发送</Badge>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryTile({ label, value, status }: { label: string; value: string; status: AcceptanceStatus }) {
  return (
    <div className="min-w-0 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="truncate text-lg font-semibold">{value}</div>
        </div>
        <StatusIcon status={status} />
      </div>
    </div>
  );
}

function BlockingList({
  items,
  expandedKey,
  onToggle,
}: {
  items: Array<{ type: string; severity?: string; title: string; detail?: string; url?: string }>;
  expandedKey: string | null;
  onToggle: (key: string | null) => void;
}) {
  if (items.length === 0) return null;

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">阻塞项</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, index) => {
          const key = `${item.type}-${item.title}-${index}`;
          const expanded = expandedKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(expanded ? null : key)}
              className="block w-full min-w-0 overflow-hidden rounded-md border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={expanded}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={severityBadgeClass(item.severity)}>
                  {item.severity || item.type}
                </Badge>
                <span className="min-w-0 flex-1 break-words text-sm font-medium">{item.title}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
              </div>
              {!expanded && item.detail && <div className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">{item.detail}</div>}
              {!expanded && item.url && <div className="mt-1 truncate text-xs text-muted-foreground">{item.url}</div>}
              {expanded && (
                <div className="mt-3 grid min-w-0 max-w-full gap-2 overflow-hidden rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                  <DetailLine label="类型" value={item.type} />
                  <DetailLine label="级别" value={item.severity || "-"} />
                  <DetailLine label="原因" value={item.detail || "-"} />
                  <DetailLine label="URL" value={item.url || "-"} breakAll />
                  {item.url && (
                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigator.clipboard.writeText(`curl -i "${item.url}"`);
                        }}
                      >
                        <Clipboard className="mr-2 h-4 w-4" />
                        复制 curl
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SectionResults({ sections }: { sections: AcceptanceSection[] }) {
  if (sections.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">运行后会在这里显示每个测试组的结果。</CardContent>
      </Card>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      {sections.map((section) => (
        <SectionResult key={`${section.suite}-${section.id}`} section={section} />
      ))}
    </div>
  );
}

function SectionResult({ section }: { section: AcceptanceSection }) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const failedOrWarned = section.items.filter((item) => item.status !== "pass");
  const shownItems = failedOrWarned.length > 0 ? failedOrWarned : section.items.slice(0, 6);

  return (
    <Card id={section.suite ? sectionDomId(section.suite as AcceptanceSuite) : undefined} className="min-w-0 scroll-mt-20 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <StatusIcon status={section.status} />
            <span className="truncate">{section.name}</span>
          </CardTitle>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={section.failed > 0 ? "destructive" : "secondary"}>{section.passed}/{section.total}</Badge>
            {section.warned > 0 && <Badge variant="outline">{section.warned} warn</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[38%]">检查项</TableHead>
              <TableHead className="w-[24%]">预期</TableHead>
              <TableHead className="w-[24%]">实际</TableHead>
              <TableHead className="w-[72px] text-right">curl</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shownItems.map((item) => (
              <ResultRow
                key={item.id}
                item={item}
                expanded={expandedItem === itemKey(item)}
                onToggle={() => {
                  const key = itemKey(item);
                  setExpandedItem((prev) => (prev === key ? null : key));
                }}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ResultRow({
  item,
  expanded,
  onToggle,
}: {
  item: AcceptanceItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const copyCurl = () => {
    if (!item.url || item.url.startsWith("/")) return;
    navigator.clipboard.writeText(`curl -i "${item.url}"`);
  };

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
      >
        <TableCell className="max-w-0 whitespace-normal align-top">
          <div className="flex items-start gap-2">
            <StatusIcon status={item.status} />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <div className="break-words text-sm font-medium">{item.name}</div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
              </div>
              {item.severity && <Badge variant="outline" className={severityBadgeClass(item.severity)}>{item.severity}</Badge>}
              {item.url && <div className="break-all text-xs text-muted-foreground">{item.url}</div>}
              {item.failureReason && <div className={`${INLINE_TEXT_CLASS} text-xs text-red-500`}>{cleanDisplayText(item.failureReason)}</div>}
            </div>
          </div>
        </TableCell>
        <TableCell className="max-w-0 whitespace-normal align-top text-xs text-muted-foreground">
          <div className={INLINE_TEXT_CLASS}>{cleanDisplayText(item.expected)}</div>
        </TableCell>
        <TableCell className="max-w-0 whitespace-normal align-top text-xs text-muted-foreground">
          <div className={INLINE_TEXT_CLASS}>{cleanDisplayText(item.actual)}</div>
        </TableCell>
        <TableCell className="align-top text-right">
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.stopPropagation();
              copyCurl();
            }}
            type="button"
            disabled={!item.url}
          >
            <Clipboard className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={4} className="max-w-0 overflow-hidden bg-muted/30 p-3">
            <div className="grid min-w-0 max-w-full gap-2 overflow-hidden rounded-md border bg-background p-3 text-xs text-muted-foreground">
              <DetailLine label="状态" value={item.status} />
              <DetailLine label="级别" value={item.severity || "-"} />
              <DetailLine label="URL" value={item.url || "-"} breakAll />
              <DetailLine label="预期" value={item.expected} />
              <DetailLine label="实际" value={item.actual} />
              <DetailLine label="失败原因" value={item.failureReason || "-"} />
              <DetailLine label="耗时" value={`${item.durationMs}ms`} />
              {item.responseHeaders && Object.keys(item.responseHeaders).length > 0 && (
                <div className="min-w-0">
                  <div className="mb-1 font-medium text-foreground">Response Headers</div>
                  <pre className={`${DETAIL_TEXT_CLASS} max-h-48 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-relaxed`}>
                    {JSON.stringify(item.responseHeaders, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ReportExport({ result }: { result: AcceptanceResult | null }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">报告导出</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!result} onClick={() => result && downloadReport("json", result)}>
          <FileJson className="mr-2 h-4 w-4" />
          JSON
        </Button>
        <Button variant="outline" disabled={!result} onClick={() => result && downloadReport("md", result)}>
          <FileText className="mr-2 h-4 w-4" />
          Markdown
        </Button>
        <Button variant="outline" disabled={!result} onClick={() => result && downloadReport("html", result)}>
          <Download className="mr-2 h-4 w-4" />
          HTML
        </Button>
      </CardContent>
    </Card>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0" />
    </div>
  );
}

function StatusIcon({ status, spinning = false }: { status: AcceptanceStatus; spinning?: boolean }) {
  if (spinning || status === "pending") return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />;
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />;
  if (status === "warn" || status === "manual") return <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" />;
  return <XCircle className="h-4 w-4 shrink-0 text-red-500" />;
}

function sectionDomId(suite: AcceptanceSuite): string {
  return `acceptance-suite-${suite}`;
}

function itemKey(item: AcceptanceItem): string {
  return `${item.sectionId || item.suite || "item"}-${item.id}`;
}

function DetailLine({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-1 sm:grid-cols-[120px_minmax(0,1fr)]">
      <div className="font-medium text-foreground">{label}</div>
      <div className={breakAll ? `${DETAIL_TEXT_CLASS} break-all` : DETAIL_TEXT_CLASS}>{cleanDisplayText(value)}</div>
    </div>
  );
}

function cleanDisplayText(value: string): string {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function severityBadgeClass(severity?: string): string {
  switch (severity) {
    case "P0":
      return "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950";
    case "P1":
      return "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
    case "P2":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200";
    case "P3":
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200";
    default:
      return "border-border bg-secondary text-secondary-foreground";
  }
}

function toOptionalNumber(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function downloadReport(format: "json" | "md" | "html", result: AcceptanceResult) {
  const content = format === "json"
    ? JSON.stringify(result, null, 2)
    : format === "md"
      ? markdownReport(result)
      : htmlReport(result);
  const mime = format === "json" ? "application/json" : format === "md" ? "text/markdown" : "text/html";
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `migration-acceptance-${new Date(result.timestamp).toISOString().slice(0, 10)}.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}

function markdownReport(result: AcceptanceResult): string {
  const blockers = result.goNoGo?.blockers || [];
  return [
    "# Migration Acceptance Report",
    "",
    `- Env: ${result.env}`,
    `- Next URL: ${result.baseUrl}`,
    `- Gatsby URL: ${DEFAULT_GATSBY_URL}`,
    `- Go/No-Go: ${(result.goNoGo?.decision || (result.summary.failed > 0 ? "no-go" : "go")).toUpperCase()}`,
    `- Passed: ${result.summary.passed}/${result.summary.total}`,
    `- Failed: ${result.summary.failed}`,
    `- Warned: ${result.summary.warned}`,
    "",
    "## Blockers",
    ...(blockers.length ? blockers.map((item) => `- [${item.severity || item.type}] ${item.title}: ${item.detail || ""}`) : ["- None"]),
    "",
    "## Automated Sections",
    ...result.sections.map((section) => `- ${section.name}: ${section.status.toUpperCase()} (${section.passed}/${section.total}, failed ${section.failed}, warned ${section.warned})`),
  ].join("\n");
}

function htmlReport(result: AcceptanceResult): string {
  const sections = result.sections.map((section) => `
    <tr>
      <td>${escapeHtml(section.name)}</td>
      <td>${escapeHtml(section.status)}</td>
      <td>${section.passed}/${section.total}</td>
      <td>${section.failed}</td>
      <td>${section.warned}</td>
    </tr>
  `).join("");
  return `<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <title>Migration Acceptance Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1080px; margin: 32px auto; color: #111827; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
    th { background: #f9fafb; }
  </style>
</head>
<body>
  <h1>Migration Acceptance Report</h1>
  <p>Env: ${escapeHtml(result.env)}</p>
  <p>Next URL: ${escapeHtml(result.baseUrl)}</p>
  <p>Go/No-Go: ${escapeHtml((result.goNoGo?.decision || (result.summary.failed > 0 ? "no-go" : "go")).toUpperCase())}</p>
  <table>
    <thead><tr><th>Suite</th><th>Status</th><th>Passed</th><th>Failed</th><th>Warned</th></tr></thead>
    <tbody>${sections}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
