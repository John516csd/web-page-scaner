"use client";

import type { DiffResult } from "../types";
import { HttpResult } from "./http-result";
import { SeoResult } from "./seo-result";
import { ContentResult } from "./content-result";
import { VisualResult } from "./visual-result";

export function DiffResultView({ result }: { result: DiffResult }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        对比时间: {new Date(result.timestamp).toLocaleString()}
      </p>
      {result.http && <HttpResult data={result.http} />}
      {result.seo && <SeoResult data={result.seo} />}
      {result.content && <ContentResult data={result.content} />}
      {result.visual && <VisualResult data={result.visual} />}
    </div>
  );
}
