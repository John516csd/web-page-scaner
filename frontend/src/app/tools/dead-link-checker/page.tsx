"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeadLinkForm } from "@/tools/dead-link-checker/components/dead-link-form";
import { DeadLinkProgressView } from "@/tools/dead-link-checker/components/dead-link-progress";
import { DeadLinkResultView } from "@/tools/dead-link-checker/components/dead-link-result";
import {
  SiteDeadLinkForm,
  type SiteDeadLinkFormState,
} from "@/tools/dead-link-checker/components/site-dead-link-form";
import { SiteDeadLinkBatchResult } from "@/tools/dead-link-checker/components/site-dead-link-result";
import {
  ExportSingleDeadLinkButtons,
  ExportBatchDeadLinkButtons,
} from "@/tools/dead-link-checker/components/export-dead-link-buttons";
import { useDeadLinkChecker } from "@/tools/dead-link-checker/hooks/use-dead-link-checker";
import { useSiteDeadLinkChecker } from "@/tools/dead-link-checker/hooks/use-site-dead-link-checker";

export default function DeadLinkCheckerPage() {
  const singleChecker = useDeadLinkChecker();
  const siteChecker = useSiteDeadLinkChecker();

  const [siteFormState, setSiteFormState] =
    useState<SiteDeadLinkFormState | null>(null);
  const [autoRun, setAutoRun] = useState(false);

  const handleSiteSubmit = (params: SiteDeadLinkFormState) => {
    setSiteFormState(params);
    siteChecker.setPaths(params.paths);
    siteChecker.runBatch(
      params.baseUrl,
      params.paths,
      params.batchSize,
      0,
      params.options
    );
  };

  const handleContinueBatch = useCallback(() => {
    if (!siteFormState) return;
    siteChecker.runBatch(
      siteFormState.baseUrl,
      siteFormState.paths,
      siteFormState.batchSize,
      siteChecker.nextStart,
      siteFormState.options
    );
  }, [siteFormState, siteChecker.nextStart]);

  useEffect(() => {
    if (autoRun && siteChecker.batchDone && siteChecker.hasMore && !siteChecker.loading && siteFormState) {
      handleContinueBatch();
    }
  }, [autoRun, siteChecker.batchDone, siteChecker.hasMore, siteChecker.loading, siteFormState, handleContinueBatch]);

  const handleRerunFailed = () => {
    if (!siteFormState) return;
    const failedPaths = siteChecker.results
      .filter((r) => r.status === "fail" || r.status === "error")
      .map((r) => r.path);

    if (failedPaths.length === 0) return;

    siteChecker.setPaths(failedPaths);
    siteChecker.runBatch(
      siteFormState.baseUrl,
      failedPaths,
      siteFormState.batchSize,
      0,
      siteFormState.options
    );
  };

  return (
    <div>
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="mb-4 -ml-2 gap-1 text-muted-foreground"
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
        </Button>
        <h1 className="mb-1 text-2xl font-bold tracking-tight">
          Dead Link Checker
        </h1>
        <p className="text-muted-foreground">
          检查页面上的死链（4xx/5xx 响应）
        </p>
      </div>

      <Tabs defaultValue="single">
        <TabsList className="mb-6">
          <TabsTrigger value="single">单页检查</TabsTrigger>
          <TabsTrigger value="site">站点检查</TabsTrigger>
        </TabsList>

        <TabsContent value="single" forceMount className="data-[state=inactive]:hidden">
          <Card className="mb-8">
            <CardContent className="pt-6">
              <DeadLinkForm
                onSubmit={singleChecker.run}
                onReset={singleChecker.reset}
                loading={singleChecker.loading}
              />
            </CardContent>
          </Card>

          {singleChecker.progress && (
            <div className="mb-6">
              <DeadLinkProgressView progress={singleChecker.progress} />
            </div>
          )}

          {singleChecker.error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{singleChecker.error}</AlertDescription>
            </Alert>
          )}

          {singleChecker.result && (
            <>
              <DeadLinkResultView result={singleChecker.result} />
              <ExportSingleDeadLinkButtons result={singleChecker.result} />
            </>
          )}
        </TabsContent>

        <TabsContent value="site" forceMount className="data-[state=inactive]:hidden">
          <Card className="mb-8">
            <CardContent className="pt-6">
              <SiteDeadLinkForm
                onLoadSitemap={siteChecker.loadSitemap}
                onSetPaths={siteChecker.setPaths}
                onSubmit={handleSiteSubmit}
                onReset={() => {
                  siteChecker.reset();
                  setSiteFormState(null);
                }}
                loading={siteChecker.loading}
                paths={siteChecker.paths}
                totalPages={siteChecker.totalPages}
                confirmed={siteFormState !== null}
                confirmedState={siteFormState}
                autoRun={autoRun}
                onAutoRunChange={setAutoRun}
              />
            </CardContent>
          </Card>

          {siteChecker.error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{siteChecker.error}</AlertDescription>
            </Alert>
          )}

          {(siteChecker.results.length > 0 || siteChecker.loading) && (
            <>
              <SiteDeadLinkBatchResult
                results={siteChecker.results}
                totalPages={siteChecker.totalPages}
                currentBatch={siteChecker.currentBatch}
                hasMore={siteChecker.hasMore}
                loading={siteChecker.loading}
                onContinue={handleContinueBatch}
                onStop={siteChecker.stop}
                autoRun={autoRun}
              />
              {!siteChecker.loading && siteChecker.results.length > 0 && (
                <ExportBatchDeadLinkButtons
                  results={siteChecker.results}
                  onRerunFailed={handleRerunFailed}
                />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
