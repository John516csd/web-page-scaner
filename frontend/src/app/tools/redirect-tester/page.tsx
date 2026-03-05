"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TestCaseEditor } from "@/tools/redirect-tester/components/test-case-editor";
import { TestResults } from "@/tools/redirect-tester/components/test-results";
import { useRedirectTester } from "@/tools/redirect-tester/hooks/use-redirect-tester";
import {
  DEFAULT_TEST_CASES,
  type RedirectTestCase,
} from "@/tools/redirect-tester/types";

export default function RedirectTesterPage() {
  const [testCases, setTestCases] =
    useState<RedirectTestCase[]>(DEFAULT_TEST_CASES);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(DEFAULT_TEST_CASES.map((tc) => tc.id))
  );
  const [proxy, setProxy] = useState("http://127.0.0.1:9674");

  const tester = useRedirectTester();

  const { run, stop, loading, results, summary, currentTest, progress } = tester;

  const handleRun = useCallback(
    (cases: RedirectTestCase[]) => {
      run(cases, proxy || undefined);
    },
    [run, proxy]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Redirect Tester
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            CloudFront / Lambda@Edge 重定向规则测试
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground shrink-0">
            代理
          </Label>
          <Input
            value={proxy}
            onChange={(e) => setProxy(e.target.value)}
            placeholder="留空则直连"
            className="font-mono text-xs h-7 w-56"
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
      </div>

      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: test cases */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm">测试用例</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3 pb-3 px-3 flex-1 overflow-y-auto max-h-[calc(100vh-220px)]">
            <TestCaseEditor
              testCases={testCases}
              onTestCasesChange={setTestCases}
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
              onRun={handleRun}
              onStop={stop}
              loading={loading}
            />
          </CardContent>
        </Card>

        {/* Right: results */}
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto space-y-3">
          {results.length > 0 || loading ? (
            <TestResults
              results={results}
              summary={summary}
              loading={loading}
              currentTest={currentTest}
              progress={progress}
            />
          ) : (
            <Card className="flex items-center justify-center min-h-[300px]">
              <CardContent className="text-center">
                <div className="mb-3 text-4xl opacity-10 font-mono">
                  {"</>"}
                </div>
                <p className="text-muted-foreground text-sm">
                  选择测试用例并点击&quot;运行&quot;
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
