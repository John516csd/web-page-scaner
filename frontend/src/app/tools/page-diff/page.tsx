"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DiffForm } from "@/tools/page-diff/components/diff-form";
import { DiffProgress } from "@/tools/page-diff/components/diff-progress";
import { DiffResultView } from "@/tools/page-diff/components/diff-result";
import { SiteDiffForm } from "@/tools/page-diff/components/site-diff-form";
import { BatchResult } from "@/tools/page-diff/components/batch-result";
import {
  ExportSingleButtons,
  ExportBatchButtons,
} from "@/tools/page-diff/components/export-buttons";
import { useDiff } from "@/tools/page-diff/hooks/use-diff";
import { useSiteDiff } from "@/tools/page-diff/hooks/use-site-diff";
import type { DiffOptions, CheckType } from "@/tools/page-diff/types";

export default function PageDiffTool() {
  const singleDiff = useDiff();
  const siteDiff = useSiteDiff();

  const [siteFormState, setSiteFormState] = useState<{
    baseUrlA: string;
    baseUrlB: string;
    paths: string[];
    checks: CheckType[];
    batchSize: number;
    options?: DiffOptions;
  } | null>(null);

  const handleSiteSubmit = (params: {
    baseUrlA: string;
    baseUrlB: string;
    paths: string[];
    checks: CheckType[];
    batchSize: number;
    options?: DiffOptions;
  }) => {
    setSiteFormState(params);
    siteDiff.setPaths(params.paths);
    siteDiff.runBatch(
      params.baseUrlA,
      params.baseUrlB,
      params.paths,
      params.checks,
      params.batchSize,
      0,
      params.options
    );
  };

  const handleContinueBatch = () => {
    if (!siteFormState) return;
    siteDiff.runBatch(
      siteFormState.baseUrlA,
      siteFormState.baseUrlB,
      siteFormState.paths,
      siteFormState.checks,
      siteFormState.batchSize,
      siteDiff.nextStart,
      siteFormState.options
    );
  };

  const handleRerunFailed = () => {
    if (!siteFormState) return;
    const failedPaths = siteDiff.results
      .filter((r) => r.status === "fail" || r.status === "error")
      .map((r) => r.path);

    if (failedPaths.length === 0) return;

    siteDiff.setPaths(failedPaths);
    siteDiff.runBatch(
      siteFormState.baseUrlA,
      siteFormState.baseUrlB,
      failedPaths,
      siteFormState.checks,
      siteFormState.batchSize,
      0,
      siteFormState.options
    );
  };

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 gap-1 text-muted-foreground">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
        </Button>
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Page Diff</h1>
        <p className="text-muted-foreground">
          对比两个网页在 HTTP、SEO、视觉上的差异
        </p>
      </div>

      <Tabs defaultValue="single">
        <TabsList className="mb-6">
          <TabsTrigger value="single">单页对比</TabsTrigger>
          <TabsTrigger value="site">站点对比</TabsTrigger>
        </TabsList>

        <TabsContent value="single" forceMount className="data-[state=inactive]:hidden">
          <Card className="mb-8">
            <CardContent className="pt-6">
              <DiffForm onSubmit={singleDiff.runDiff} onReset={singleDiff.reset} loading={singleDiff.loading} />
            </CardContent>
          </Card>

          {singleDiff.loading && <DiffProgress steps={singleDiff.steps} />}

          {singleDiff.error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{singleDiff.error}</AlertDescription>
            </Alert>
          )}

          {singleDiff.result && (
            <>
              <DiffResultView result={singleDiff.result} />
              <ExportSingleButtons result={singleDiff.result} />
            </>
          )}
        </TabsContent>

        <TabsContent value="site" forceMount className="data-[state=inactive]:hidden">
          <Card className="mb-8">
            <CardContent className="pt-6">
              <SiteDiffForm
                onLoadSitemap={siteDiff.loadSitemap}
                onSetPaths={siteDiff.setPaths}
                onSubmit={handleSiteSubmit}
                onReset={() => { siteDiff.reset(); setSiteFormState(null); }}
                loading={siteDiff.loading}
                paths={siteDiff.paths}
                totalPages={siteDiff.totalPages}
                confirmed={siteFormState !== null}
                confirmedState={siteFormState}
              />
            </CardContent>
          </Card>

          {siteDiff.error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{siteDiff.error}</AlertDescription>
            </Alert>
          )}

          {(siteDiff.results.length > 0 || siteDiff.loading) && (
            <>
              <BatchResult
                results={siteDiff.results}
                totalPages={siteDiff.totalPages}
                currentBatch={siteDiff.currentBatch}
                hasMore={siteDiff.hasMore}
                loading={siteDiff.loading}
                onContinue={handleContinueBatch}
              />
              {!siteDiff.loading && siteDiff.results.length > 0 && (
                <ExportBatchButtons
                  results={siteDiff.results}
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
