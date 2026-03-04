"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScanPanel } from "@/tools/migration-tracker/components/scan-panel";
import { PagesTable } from "@/tools/migration-tracker/components/pages-table";
import { ImportChangesForm } from "@/tools/migration-tracker/components/import-changes-form";
import { ChangesTable } from "@/tools/migration-tracker/components/changes-table";
import { ReportExport } from "@/tools/migration-tracker/components/report-export";
import { WorkflowGuide } from "@/tools/migration-tracker/components/workflow-guide";
import { useSession } from "@/tools/migration-tracker/hooks/use-session";
import { useScan, useAnalyze } from "@/tools/migration-tracker/hooks/use-scan";
import { useChanges } from "@/tools/migration-tracker/hooks/use-changes";
import type { SessionStats } from "@/tools/migration-tracker/types";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = parseInt(id);
  const { session, loading, error, loadSession } = useSession(sessionId);
  const scan = useScan(sessionId);
  const analyze = useAnalyze(sessionId);
  const changes = useChanges(sessionId);
  const [pagesRefresh, setPagesRefresh] = useState(0);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!session) return;
    changes.loadChanges();
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh session stats after each batch completes
  useEffect(() => {
    if (scan.batchDone) {
      loadSession();
      setPagesRefresh((n) => n + 1);
    }
  }, [scan.batchDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh changes after analysis completes
  useEffect(() => {
    if (analyze.done) {
      changes.loadChanges();
    }
  }, [analyze.done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="text-muted-foreground p-8">加载中...</div>;
  }

  if (error || !session) {
    return (
      <Alert variant="destructive" className="m-8">
        <AlertDescription>{error ?? "会话不存在"}</AlertDescription>
      </Alert>
    );
  }

  const stats = session.stats;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 gap-1 text-muted-foreground">
          <Link href="/tools/migration-tracker">
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">{session.name}</h1>
            <p className="text-xs text-muted-foreground">
              {session.gatsby_base_url} → {session.nextjs_base_url}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={loadSession}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <ReportExport sessionId={sessionId} sessionName={session.name} />
          </div>
        </div>
      </div>

      {/* Workflow guide */}
      <div className="mb-5">
        <WorkflowGuide />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="总页面" value={stats.total_pages} />
        <StatCard label="已扫描" value={stats.scanned_pages} />
        <StatCard label="通过" value={stats.pass_pages} color="green" />
        <StatCard label="失败" value={stats.fail_pages} color="red" />
      </div>

      <Tabs defaultValue="scan">
        <TabsList className="mb-6">
          <TabsTrigger value="scan">页面扫描</TabsTrigger>
          <TabsTrigger value="changes">
            变更记录
            {stats.total_changes > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {stats.total_changes}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Scan tab */}
        <TabsContent value="scan" forceMount className="data-[state=inactive]:hidden space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">扫描控制</CardTitle>
            </CardHeader>
            <CardContent>
              <ScanPanel
                scanStatus={session.scan_status}
                scanProgress={session.scan_progress}
                scanning={scan.scanning}
                progress={scan.progress}
                batchDone={scan.batchDone}
                hasMore={scan.hasMore}
                error={scan.error}
                batchSize={scan.batchSize}
                autoRun={scan.autoRun}
                onBatchSizeChange={scan.setBatchSize}
                onAutoRunChange={scan.setAutoRun}
                onStart={scan.startScan}
                onContinue={scan.continueScan}
                onStop={scan.stopScan}
                totalPages={stats.total_pages}
                scannedPages={stats.scanned_pages}
              />
            </CardContent>
          </Card>

          {(stats.total_pages > 0 || scan.batchDone) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">页面结果</CardTitle>
              </CardHeader>
              <CardContent>
                <PagesTable sessionId={sessionId} refreshTrigger={pagesRefresh} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Changes tab */}
        <TabsContent value="changes" forceMount className="data-[state=inactive]:hidden space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">导入变更记录</CardTitle>
            </CardHeader>
            <CardContent>
              <ImportChangesForm
                sessionId={sessionId}
                onImport={changes.importCsv}
                importing={changes.importing}
                onRefresh={changes.loadChanges}
              />
            </CardContent>
          </Card>

          {changes.changes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">变更记录（{changes.changes.length}）</CardTitle>
                  <div className="flex items-center gap-2">
                    {analyze.analyzing && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Progress
                          value={analyze.total > 0 ? Math.round((analyze.analyzed / analyze.total) * 100) : 0}
                          className="w-24 h-1.5"
                        />
                        <span>{analyze.analyzed}/{analyze.total}</span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`确定删除全部 ${changes.changes.length} 条变更记录？`)) {
                          changes.deleteAllChanges();
                        }
                      }}
                      disabled={analyze.analyzing}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      清空全部
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={analyze.startAnalyze}
                      disabled={analyze.analyzing}
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      {analyze.analyzing ? "AI 分析中..." : "AI 分析全部"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {analyze.error && (
                  <Alert variant="destructive" className="mb-3">
                    <AlertDescription>{analyze.error}</AlertDescription>
                  </Alert>
                )}
                <ChangesTable
                  changes={changes.changes}
                  onUpdateStatus={changes.updateStatus}
                  onDelete={changes.deleteChange}
                />
              </CardContent>
            </Card>
          )}

          {/* Change stats */}
          {stats.total_changes > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="已验证" value={stats.verified_changes} color="green" />
              <StatCard label="验证失败" value={stats.failed_changes} color="red" />
              <StatCard label="已跳过" value={stats.skipped_changes} />
              <StatCard label="待处理" value={stats.pending_changes} color="yellow" />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "green" | "red" | "yellow";
}) {
  const colorClass =
    color === "green"
      ? "text-green-600"
      : color === "red"
      ? "text-red-600"
      : color === "yellow"
      ? "text-yellow-600"
      : "text-foreground";

  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}
